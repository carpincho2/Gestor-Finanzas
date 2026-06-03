import os
import re
import requests
import bcrypt
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Index, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Helper to load .env variables manually (without external package dependencies)
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("=", 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = parts[1].strip()
                    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                        val = val[1:-1]
                    os.environ[key] = val

# Load it right away
load_env()

# ============================================================
#  DATABASE CONFIGURATION (SQLite / PostgreSQL)
# ============================================================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database.db")

# Fix for Render/Heroku postgresql:// scheme
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Check if SQLite to apply check_same_thread
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class TicketItem(Base):
    __tablename__ = "ticket_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=True)
    store_name = Column(String(255), nullable=True)
    item_name = Column(String(255), nullable=False)
    qty = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=True)
    total_price = Column(Float, nullable=True)
    date = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# ============================================================
#  MODELS
# ============================================================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    google_id = Column(String(255), index=True, nullable=True)
    avatar = Column(String(10), default="JP")
    picture = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Auto-create tables (SQLite and PostgreSQL)
Base.metadata.create_all(bind=engine)

# ============================================================
#  FASTAPI APPLICATION SETUP
# ============================================================
app = FastAPI(title="Flujo Finance Manager API")

# CORS middleware supporting dynamic localhost/127.0.0.1 ports
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session middleware (equivalent to PHP session_start)
# Under local development (HTTP), same_site="lax" and secure=False allows cookies to persist
SECRET_KEY = os.getenv("SECRET_KEY", "flujo-secret-key-change-this-in-prod-12345")
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="flujo_session",
    max_age=86400 * 30,  # 30 days
    same_site="lax",
    https_only=False
)

# ============================================================
#  DEPENDENCIES
# ============================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================================
#  SCHEMAS
# ============================================================
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class GoogleRequest(BaseModel):
    credential: str

class OCRParseRequest(BaseModel):
    text: str

class TicketItemSchema(BaseModel):
    qty: float
    desc: str
    price: float
    total: float

class OCRSaveRequest(BaseModel):
    nombre_local: Optional[str] = None
    fecha: Optional[str] = None
    articulos: list[TicketItemSchema]

# ============================================================
#  ENDPOINTS
# ============================================================

@app.get("/api/auth/me")
async def get_me(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Sin sesión activa"})
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        request.session.clear()
        return JSONResponse(status_code=404, content={"error": "Usuario no encontrado"})
        
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar": user.avatar,
            "picture": user.picture
        }
    }

@app.post("/api/auth/me")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True, "message": "Sesión cerrada"}

@app.post("/api/auth/login")
async def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip()
    password = payload.password
    
    if not email or not password:
        return JSONResponse(status_code=422, content={"error": "Email y contraseña son requeridos"})
        
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.password_hash:
        return JSONResponse(status_code=401, content={"error": "Email o contraseña incorrectos"})
        
    # Verify password against bcrypt hash
    try:
        is_valid = bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8"))
    except Exception:
        is_valid = False
        
    if not is_valid:
        return JSONResponse(status_code=401, content={"error": "Email o contraseña incorrectos"})
        
    request.session["user_id"] = user.id
    request.session["email"] = user.email
    
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar": user.avatar,
            "picture": user.picture
        }
    }

@app.post("/api/auth/register", status_code=201)
async def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    name = payload.name.strip()
    email = payload.email.strip()
    password = payload.password
    
    if not name:
        return JSONResponse(status_code=422, content={"error": "El nombre es requerido"})
    if not email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return JSONResponse(status_code=422, content={"error": "El email no es válido"})
    if len(password) < 6:
        return JSONResponse(status_code=422, content={"error": "La contraseña debe tener al menos 6 caracteres"})
        
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        return JSONResponse(status_code=409, content={"error": "Ya existe una cuenta con ese email. Iniciá sesión."})
        
    # Compute avatar initials
    parts = name.split()
    avatar = (parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper()
    avatar = avatar[:10]  # Capped at column limit
    
    # Hash password using bcrypt
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    
    # Insert new user
    new_user = User(
        name=name,
        email=email,
        password_hash=hashed_password,
        avatar=avatar
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    request.session["user_id"] = new_user.id
    request.session["email"] = new_user.email
    
    return {
        "ok": True,
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "avatar": new_user.avatar,
            "picture": None
        }
    }

@app.post("/api/auth/google")
async def google_login(request: Request, payload: GoogleRequest, db: Session = Depends(get_db)):
    credential = payload.credential
    if not credential:
        return JSONResponse(status_code=422, content={"error": "Credencial requerida"})
        
    # Verify token with Google's tokeninfo API
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={requests.utils.quote(credential)}"
    try:
        response = requests.get(url, timeout=10)
    except Exception as e:
        return JSONResponse(status_code=502, content={"error": "No se pudo verificar el token con Google. Verificá tu conexión."})
        
    if response.status_code != 200:
        return JSONResponse(status_code=401, content={"error": "Token de Google inválido o vencido."})
        
    token_data = response.json()
    if "error_description" in token_data or "email" not in token_data:
        return JSONResponse(status_code=401, content={"error": f"Token de Google inválido: {token_data.get('error_description', 'desconocido')}"})
        
    google_id = token_data.get("sub", "")
    email = token_data.get("email", "")
    name = token_data.get("name", email)
    picture = token_data.get("picture")
    
    # Calculate avatar initials
    parts = name.split()
    avatar = (parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper()
    avatar = avatar[:10]
    
    # Find existing user by google_id or email
    user = db.query(User).filter((User.google_id == google_id) | (User.email == email)).first()
    
    if user:
        # Update user google_id and picture if missing
        user.google_id = google_id
        user.picture = picture
        db.commit()
        db.refresh(user)
    else:
        # Create new user
        user = User(
            name=name,
            email=email,
            google_id=google_id,
            avatar=avatar,
            picture=picture
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    request.session["user_id"] = user.id
    request.session["email"] = user.email
    
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar": user.avatar,
            "picture": user.picture
        }
    }

# ============================================================
#  OCR AND AI INTEGRATION ENDPOINTS
# ============================================================

@app.post("/api/ocr/parse")
async def ocr_parse(request: Request, payload: OCRParseRequest):
    load_env()
    provider = os.getenv("AI_PROVIDER", "none").strip().lower()
    text = payload.text
    
    if provider == "none" or not provider:
        return {"fallback": True}
        
    prompt = f"""
You are an expert OCR receipt parsing assistant.
Analyze the following raw OCR text from a supermarket/store ticket and extract the fields in JSON format:
{{
  "nombre_local": "Name of the business or store (e.g. Carrefour, Coto, Dia, Jumbo, Disco, YPF, Kiosco, etc.). Never output 'TOTAL', 'SUBTOTAL', or amounts here.",
  "fecha": "Date of the purchase in YYYY-MM-DD format (if not found or invalid, return null)",
  "hora": "Time of the purchase in HH:MM format (if not found or invalid, return null)",
  "total": total amount paid as a float,
  "forma_pago": "Payment method (e.g., 'Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Mercado Pago', 'Cuenta DNI', etc. or null)",
  "direccion": "Address of the store (if found, otherwise null)",
  "categoria": "Category (choose one of: 'Supermercado / Almacén', 'Salidas / Restaurantes', 'Transporte', 'Hogar / Servicios', 'Entretenimiento / Suscripciones', 'Salud / Farmacia', 'Compras / Ropa', 'Educación', 'Ingresos (Sueldo/Freelance)', 'Ahorro / Inversiones', 'Otros')",
  "articulos": [
    {{
      "qty": quantity of the item (float, default 1.0),
      "desc": "Name/description of the item",
      "price": unit price of the item (float),
      "total": total price of the item (qty * price) (float)
    }}
  ]
}}

Ensure that "nombre_local" is the actual business name and NEVER "TOTAL" or "PAGAR".
Only output valid JSON matching the schema exactly.

Ticket text:
{text}
"""

    try:
        if provider == "ollama":
            ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434").strip()
            ollama_model = os.getenv("OLLAMA_MODEL", "llama3").strip()
            
            response = requests.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                },
                timeout=60
            )
            if response.status_code == 200:
                res_data = response.json()
                raw_response = res_data.get("response", "{}")
                import json
                parsed_data = json.loads(raw_response)
                return parsed_data
            else:
                return {"fallback": True, "error": f"Ollama returned status {response.status_code}"}
                
        elif provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY", "").strip()
            if not api_key:
                return {"fallback": True, "error": "Gemini API Key missing"}
                
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload_data = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json"
                }
            }
            response = requests.post(url, json=payload_data, headers=headers, timeout=20)
            if response.status_code == 200:
                res_json = response.json()
                parts = res_json.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])
                if parts:
                    raw_text = parts[0].get("text", "{}")
                    import json
                    parsed_data = json.loads(raw_text)
                    return parsed_data
                return {"fallback": True, "error": "No parts returned from Gemini"}
            else:
                return {"fallback": True, "error": f"Gemini returned status {response.status_code}"}
                
    except Exception as e:
        print(f"Error parsing with AI provider '{provider}': {e}")
        return {"fallback": True, "error": str(e)}

    return {"fallback": True}

@app.post("/api/ocr/save")
async def ocr_save(request: Request, payload: OCRSaveRequest, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    
    store_name = payload.nombre_local.strip() if payload.nombre_local else "Desconocido"
    fecha = payload.fecha.strip() if payload.fecha else datetime.utcnow().strftime("%Y-%m-%d")
    
    saved_count = 0
    for item in payload.articulos:
        db_item = TicketItem(
            user_id=user_id,
            store_name=store_name,
            item_name=item.desc.strip(),
            qty=item.qty,
            unit_price=item.price,
            total_price=item.total,
            date=fecha
        )
        db.add(db_item)
        saved_count += 1
        
    db.commit()
    return {"ok": True, "saved_items": saved_count}
