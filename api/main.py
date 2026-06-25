import os
import re
import json
import time
import requests
import bcrypt
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Index, Float, func
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from google import genai
from google.genai import types
from google.genai.errors import APIError

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

# Initialize Gemini Client (automatically loads GEMINI_API_KEY from environment variables)
client = genai.Client()

# ============================================================
#  DATABASE CONFIGURATION (SQLite / PostgreSQL)
# ============================================================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database.db")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# Fix for Render/Heroku postgresql:// scheme
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Check if SQLite to apply check_same_thread
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
class Base(DeclarativeBase):
    pass

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
    created_at = Column(DateTime, server_default=func.now())

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
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # banco, ahorro, efectivo, tarjeta, inversion, digital, custom
    bank = Column(String(255), nullable=True)
    balance = Column(Float, default=0.0)
    currency = Column(String(10), default="ARS")
    limit = Column(Float, default=0.0)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False)
    account_id = Column(Integer, index=True, nullable=True)  # Asociado a una cuenta
    type = Column(String(50), nullable=False)  # income o expense
    desc = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    cat = Column(String(100), nullable=False)
    date = Column(String(50), nullable=False)  # YYYY-MM-DD
    transfer_id = Column(Integer, nullable=True)  # Si pertenece a una transferencia
    created_at = Column(DateTime, server_default=func.now())

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False)
    cat = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    icon = Column(String(50), default="📦")
    limit = Column(Float, nullable=False)
    color = Column(String(50), nullable=False)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    cat = Column(String(100), nullable=False)
    emoji = Column(String(50), default="🎯")
    color = Column(String(50), nullable=False)
    target = Column(Float, nullable=False)
    current = Column(Float, default=0.0)
    deadline = Column(String(50), nullable=True)  # YYYY-MM-DD
    notes = Column(String(500), nullable=True)
    status = Column(String(50), default="active")  # active, paused, completed
    created_at = Column(DateTime, server_default=func.now())

class GoalContribution(Base):
    __tablename__ = "goal_contributions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    goal_id = Column(Integer, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(String(50), nullable=False)  # YYYY-MM-DD
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

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
# Detect HTTPS (production) for secure cookies
SECRET_KEY = os.getenv("SECRET_KEY", "flujo-secret-key-change-this-in-prod-12345")
IS_PRODUCTION = bool(os.getenv("RENDER")) or DATABASE_URL.startswith("postgresql")
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="flujo_session",
    max_age=86400 * 30,  # 30 days
    same_site="lax",
    https_only=IS_PRODUCTION  # True in Render (HTTPS), False in dev (HTTP)
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

class AIChatMessage(BaseModel):
    role: str
    content: str

class AIChatRequest(BaseModel):
    contexto_financiero: str
    pregunta: str
    historial: list[AIChatMessage]

class AIInsightsRequest(BaseModel):
    contexto_financiero: str

class AccountCreate(BaseModel):
    name: str
    type: str
    bank: Optional[str] = None
    balance: float = 0.0
    currency: str = "ARS"
    limit: float = 0.0
    notes: Optional[str] = None

class AccountUpdate(BaseModel):
    name: str
    type: str
    bank: Optional[str] = None
    balance: float
    currency: str = "ARS"
    limit: float = 0.0
    notes: Optional[str] = None

class TransactionCreate(BaseModel):
    account_id: Optional[int] = None
    type: str
    desc: str
    amount: float
    cat: str
    date: str
    transfer_id: Optional[int] = None

class BudgetCreate(BaseModel):
    cat: str
    name: str
    icon: Optional[str] = "📦"
    limit: float
    color: str
    notes: Optional[str] = None

class GoalCreate(BaseModel):
    name: str
    cat: str
    emoji: Optional[str] = "🎯"
    color: str
    target: float
    current: float = 0.0
    deadline: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "active"

class GoalContributionCreate(BaseModel):
    amount: float
    date: str
    note: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    name: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str





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

@app.delete("/api/auth/me")
async def delete_me(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Sin sesión activa"})
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return JSONResponse(status_code=404, content={"error": "Usuario no encontrado"})
    
    try:
        # Delete user related data
        db.query(Transaction).filter(Transaction.user_id == user_id).delete()
        db.query(Budget).filter(Budget.user_id == user_id).delete()
        db.query(Account).filter(Account.user_id == user_id).delete()
        
        # Goals and Contributions
        user_goals = db.query(Goal).filter(Goal.user_id == user_id).all()
        for g in user_goals:
            db.query(GoalContribution).filter(GoalContribution.goal_id == g.id).delete()
        db.query(Goal).filter(Goal.user_id == user_id).delete()
        
        db.query(TicketItem).filter(TicketItem.user_id == user_id).delete()
        
        # Delete user itself
        db.delete(user)
        db.commit()
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"error": f"Error al eliminar la cuenta: {str(e)}"})
        
    request.session.clear()
    return {"ok": True, "message": "Cuenta eliminada correctamente"}

@app.put("/api/auth/profile")
async def update_profile(request: Request, payload: ProfileUpdateRequest, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Sin sesión activa"})
    
    name = payload.name.strip()
    if not name:
        return JSONResponse(status_code=422, content={"error": "El nombre no puede estar vacío"})
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return JSONResponse(status_code=404, content={"error": "Usuario no encontrado"})
    
    user.name = name
    parts = name.split()
    avatar = (parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper()
    user.avatar = avatar[:10]
    
    db.commit()
    db.refresh(user)
    
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

@app.put("/api/auth/password")
async def change_password(request: Request, payload: PasswordChangeRequest, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Sin sesión activa"})
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return JSONResponse(status_code=404, content={"error": "Usuario no encontrado"})
    
    if user.password_hash:
        try:
            is_valid = bcrypt.checkpw(payload.current_password.encode("utf-8"), user.password_hash.encode("utf-8"))
        except Exception:
            is_valid = False
        
        if not is_valid:
            return JSONResponse(status_code=400, content={"error": "La contraseña actual es incorrecta"})
    
    if len(payload.new_password) < 6:
        return JSONResponse(status_code=422, content={"error": "La nueva contraseña debe tener al menos 6 caracteres"})
    
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(payload.new_password.encode("utf-8"), salt).decode("utf-8")
    user.password_hash = hashed_password
    db.commit()
    
    return {"ok": True, "message": "Contraseña actualizada correctamente"}

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
    
    # Los usuarios nuevos inician con cuentas y balances en cero.
    # (El código de datos semilla fue removido)
    
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

    # --- SECURITY: Validate audience (aud) matches our CLIENT_ID ---
    token_aud = token_data.get("aud", "")
    if GOOGLE_CLIENT_ID and token_aud != GOOGLE_CLIENT_ID:
        return JSONResponse(status_code=401, content={
            "error": "Token de Google no autorizado para esta aplicación."
        })

    # --- SECURITY: Verify email is confirmed by Google ---
    email_verified = token_data.get("email_verified", "false")
    if str(email_verified).lower() != "true":
        return JSONResponse(status_code=401, content={
            "error": "El email asociado a esta cuenta de Google no está verificado."
        })
        
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
        
        # Los usuarios nuevos inician en cero.
        
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
#  HELPERS
# ============================================================

def get_current_user_id(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")
    return user_id

# ============================================================
#  OCR AND AI INTEGRATION ENDPOINTS
# ============================================================

@app.post("/api/ocr/parse")
async def ocr_parse(request: Request, payload: OCRParseRequest):
    user_id = get_current_user_id(request)
    load_env()
    provider = os.getenv("AI_PROVIDER", "none").strip().lower()
    text = payload.text
    
    if provider == "none" or not provider:
        return {"fallback": True}
    
    # ────────────────────────────────────────────────────────
    #  PROMPT OPTIMIZADO EN ESPAÑOL CON FEW-SHOT EXAMPLES
    #  Diseñado para Gemini 2.0 Flash (Free Tier)
    # ────────────────────────────────────────────────────────
    prompt = f"""Sos un experto en interpretar texto OCR de tickets de supermercados y comercios argentinos.
El texto que vas a recibir fue extraído con OCR (Tesseract) y puede contener errores de lectura.

**REGLAS CLAVE:**
1. "nombre_local" SIEMPRE es el nombre del comercio o negocio. NUNCA pongas "TOTAL", "SUBTOTAL", "PAGAR", montos o códigos numéricos como nombre.
2. Corregí errores comunes de OCR: "C0T0"→"Coto", "D1SC0"→"Disco", "CARRREF0UR"→"Carrefour", "JUMB0"→"Jumbo", "McD0NALDS"→"McDonalds", "Y.P.F"→"YPF".
3. Si no podés determinar un campo con seguridad, devolvé null para ese campo.
4. La "categoria" debe ser UNA de las opciones exactas listadas abajo.
5. Los precios están en pesos argentinos (ARS). El separador decimal puede ser "," o ".".

**EJEMPLO 1:**
Texto OCR: "C0T0 C.I.C.S.A\\nSuc. 213\\n22/05/2026 14:32\\nLECHE ENTERA 1L    $1.250,00\\nPAN LACTAL         $890,50\\nTOTAL              $2.140,50\\nEFECTIVO           $3.000,00\\nVUELTO             $859,50"
Respuesta correcta:
{{"nombre_local":"Coto","fecha":"2026-05-22","hora":"14:32","total":2140.50,"forma_pago":"Efectivo","direccion":null,"categoria":"Supermercado / Almacén","articulos":[{{"qty":1.0,"desc":"Leche Entera 1L","price":1250.00,"total":1250.00}},{{"qty":1.0,"desc":"Pan Lactal","price":890.50,"total":890.50}}]}}

**EJEMPLO 2:**
Texto OCR: "D1SC0\\nAv. Santa Fe 1234\\n01/06/2026\\nCOCA COLA 1.5L x2  $2.500,00\\nTOTAL: $2.500,00\\nTarjeta Debito"
Respuesta correcta:
{{"nombre_local":"Disco","fecha":"2026-06-01","hora":null,"total":2500.00,"forma_pago":"Tarjeta de débito","direccion":"Av. Santa Fe 1234","categoria":"Supermercado / Almacén","articulos":[{{"qty":2.0,"desc":"Coca Cola 1.5L","price":1250.00,"total":2500.00}}]}}

**FORMATO DE RESPUESTA (JSON estricto):**
{{
  "nombre_local": "Nombre real del comercio (corregido de errores OCR)",
  "fecha": "YYYY-MM-DD o null",
  "hora": "HH:MM o null",
  "total": monto_total_float,
  "forma_pago": "Método de pago o null",
  "direccion": "Dirección del local o null",
  "categoria": "Una de: 'Supermercado / Almacén', 'Salidas / Restaurantes', 'Transporte', 'Hogar / Servicios', 'Entretenimiento / Suscripciones', 'Salud / Farmacia', 'Compras / Ropa', 'Educación', 'Ingresos (Sueldo/Freelance)', 'Ahorro / Inversiones', 'Otros'",
  "articulos": [
    {{
      "qty": cantidad_float,
      "desc": "Descripción del artículo",
      "price": precio_unitario_float,
      "total": precio_total_float
    }}
  ]
}}

**Texto OCR del ticket a analizar:**
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
                parsed_data = json.loads(raw_response)
                return parsed_data
            else:
                return {"fallback": True, "error": f"Ollama returned status {response.status_code}"}
                
        elif provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY", "").strip()
            if not api_key:
                return {"fallback": True, "error": "Gemini API Key missing"}
            
            # Llamamos a Gemini usando la SDK oficial con el modelo gemini-2.5-flash
            result = _call_gemini_sdk_with_retry(
                prompt=prompt,
                model_name="gemini-2.5-flash",
                expect_json=True
            )
            return result
                
    except Exception as e:
        print(f"Error parsing with AI provider '{provider}': {e}")
        return {"fallback": True, "error": str(e)}

    return {"fallback": True}


def _call_gemini_sdk_with_retry(prompt: str, model_name: str = "gemini-2.5-flash", max_retries: int = 3, expect_json: bool = True, system_instruction: Optional[str] = None, contents = None):
    """
    Llama a la API de Gemini utilizando la SDK oficial google-genai, con reintentos automáticos
    y backoff exponencial en caso de recibir errores 429 (Rate Limit).
    
    El Free Tier de Gemini 2.5 Flash tiene límites de:
    - 15 peticiones por minuto (RPM)
    - 1500 peticiones por día (RPD)
    """
    for attempt in range(max_retries + 1):
        try:
            # Determinamos los parámetros de configuración
            config_args = {}
            if expect_json:
                config_args["response_mime_type"] = "application/json"
            if system_instruction:
                config_args["system_instruction"] = system_instruction
                
            config = types.GenerateContentConfig(**config_args) if config_args else None
            
            # Si se pasa un contenido estructurado (historial del chat), lo usamos. Si no, usamos el prompt de texto simple.
            if contents is not None:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config
                )
            else:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config
                )
            
            raw_text = response.text or ""
            if expect_json:
                try:
                    return json.loads(raw_text)
                except Exception as e:
                    return {"fallback": True, "error": f"Error al parsear el JSON retornado: {str(e)}", "raw": raw_text}
            return raw_text

        except APIError as api_err:
            # Capturamos el error 429 específico de la SDK oficial (Too Many Requests / Resource Exhausted)
            if api_err.code == 429:
                if attempt < max_retries:
                    wait_time = 2 ** (attempt + 1)  # 2, 4, 8 segundos
                    print(f"[Gemini SDK] Límite de cuota (429). Reintentando en {wait_time}s... (Intento {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                else:
                    msg = "Límite de peticiones de Gemini excedido. Esperá un momento y volvé a intentar."
                    return {"fallback": True, "error": msg} if expect_json else f"Error: {msg}"
            else:
                msg = f"Error de la API de Gemini: {api_err.message} (Código {api_err.code})"
                return {"fallback": True, "error": msg} if expect_json else f"Error: {msg}"
                
        except Exception as e:
            msg = f"Error inesperado al conectar con Gemini: {str(e)}"
            return {"fallback": True, "error": msg} if expect_json else f"Error: {msg}"
            
    return {"fallback": True, "error": "Se superaron los reintentos máximos"} if expect_json else "Error: Reintentos agotados"


@app.post("/api/ai/chat")
async def ai_chat(payload: AIChatRequest, request: Request):
    user_id = get_current_user_id(request)
    load_env()
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"error": "Gemini API Key missing"}

    # Construimos la conversación
    # Rol de sistema
    system_prompt = f"""Sos un asistente financiero personal experto que habla español argentino (usá "vos", "te", "podés"). Sos amigable, directo y muy práctico. Das consejos específicos y accionables.
Siempre respondés en base al contexto financiero real del usuario que se te proporciona.
Usás emojis con moderación para hacer la respuesta más clara. Respondés de forma concisa pero completa. Nunca inventás datos que no están en el contexto.

{payload.contexto_financiero}"""

    contents = []
    # Cargamos el historial previo adaptándolo a la estructura de la SDK
    for msg in payload.historial:
        role = "model" if msg.role == "assistant" else "user"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg.content)]
            )
        )
    # Agregamos el mensaje actual
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=payload.pregunta)]
        )
    )

    result = _call_gemini_sdk_with_retry(
        prompt="",
        model_name="gemini-2.5-flash",
        expect_json=False,
        system_instruction=system_prompt,
        contents=contents
    )
    return {"ok": True, "reply": result}


@app.post("/api/ai/insights")
async def ai_insights(payload: AIInsightsRequest, request: Request):
    user_id = get_current_user_id(request)
    load_env()
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"error": "Gemini API Key missing"}

    prompt = f"""{payload.contexto_financiero}

Generá exactamente 4 insights financieros en formato JSON. Respondé SOLO con el JSON, sin texto extra, sin markdown (no uses ```json ni backticks), sin comentarios.

Formato:
[
  {{
    "tipo": "positivo|negativo|neutro|alerta",
    "titulo": "Título corto (max 6 palabras)",
    "descripcion": "Descripción concisa y accionable (max 2 oraciones en español argentino)",
    "icono": "emoji"
  }}
]

Los tipos: "positivo" = buena noticia, "negativo" = preocupación, "neutro" = observación, "alerta" = urgente.
Basate 100% en los datos reales del contexto."""

    result = _call_gemini_sdk_with_retry(
        prompt=prompt,
        model_name="gemini-2.5-flash",
        expect_json=True
    )
    if isinstance(result, dict) and result.get("fallback") and result.get("error"):
        return {"ok": False, "error": result.get("error")}
    return {"ok": True, "cards": result}

@app.post("/api/ocr/save")
async def ocr_save(request: Request, payload: OCRSaveRequest, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
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


# ============================================================
#  CRUD FINANCIAL DATA ENDPOINTS (Secure User Isolation)
# ============================================================

# --- ACCOUNTS ---
@app.get("/api/accounts")
async def get_accounts(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    accs = db.query(Account).filter(Account.user_id == user_id).all()
    return {"ok": True, "accounts": accs}

@app.post("/api/accounts", status_code=201)
async def create_account(payload: AccountCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    new_acc = Account(
        user_id=user_id,
        name=payload.name.strip(),
        type=payload.type,
        bank=payload.bank.strip() if payload.bank else None,
        balance=payload.balance,
        currency=payload.currency,
        limit=payload.limit,
        notes=payload.notes.strip() if payload.notes else None
    )
    db.add(new_acc)
    db.commit()
    db.refresh(new_acc)
    return {"ok": True, "account": new_acc}

@app.put("/api/accounts/{id}")
async def update_account(id: int, payload: AccountUpdate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    acc = db.query(Account).filter(Account.id == id, Account.user_id == user_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    acc.name = payload.name.strip()
    acc.type = payload.type
    acc.bank = payload.bank.strip() if payload.bank else None
    acc.balance = payload.balance
    acc.currency = payload.currency
    acc.limit = payload.limit
    acc.notes = payload.notes.strip() if payload.notes else None
    
    db.commit()
    db.refresh(acc)
    return {"ok": True, "account": acc}

@app.delete("/api/accounts/{id}")
async def delete_account(id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    acc = db.query(Account).filter(Account.id == id, Account.user_id == user_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    # Desasociar transacciones vinculadas a esta cuenta (poner account_id en null)
    db.query(Transaction).filter(Transaction.account_id == id, Transaction.user_id == user_id).update({Transaction.account_id: None})
    
    db.delete(acc)
    db.commit()
    return {"ok": True, "message": "Cuenta eliminada"}


# --- TRANSACTIONS ---
@app.get("/api/transactions")
async def get_transactions(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    txs = db.query(Transaction).filter(Transaction.user_id == user_id).order_by(Transaction.date.desc(), Transaction.id.desc()).all()
    return {"ok": True, "transactions": txs}

@app.post("/api/transactions", status_code=201)
async def create_transaction(payload: TransactionCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
    new_tx = Transaction(
        user_id=user_id,
        account_id=payload.account_id,
        type=payload.type,
        desc=payload.desc.strip(),
        amount=payload.amount,
        cat=payload.cat,
        date=payload.date,
        transfer_id=payload.transfer_id
    )
    db.add(new_tx)
    
    # Actualizar saldo de la cuenta asociada
    if payload.account_id:
        acc = db.query(Account).filter(Account.id == payload.account_id, Account.user_id == user_id).first()
        if acc:
            if payload.type == "income":
                acc.balance += payload.amount
            else:
                acc.balance -= payload.amount
                
    db.commit()
    db.refresh(new_tx)
    return {"ok": True, "transaction": new_tx}

@app.put("/api/transactions/{id}")
async def update_transaction(id: int, payload: TransactionCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    tx = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == user_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
        
    # Revertir saldo en la cuenta original
    if tx.account_id:
        old_acc = db.query(Account).filter(Account.id == tx.account_id, Account.user_id == user_id).first()
        if old_acc:
            if tx.type == "income":
                old_acc.balance -= tx.amount
            else:
                old_acc.balance += tx.amount
                
    # Actualizar valores
    tx.account_id = payload.account_id
    tx.type = payload.type
    tx.desc = payload.desc.strip()
    tx.amount = payload.amount
    tx.cat = payload.cat
    tx.date = payload.date
    tx.transfer_id = payload.transfer_id
    
    # Aplicar nuevo saldo en la cuenta (puede ser la misma o una nueva)
    if payload.account_id:
        new_acc = db.query(Account).filter(Account.id == payload.account_id, Account.user_id == user_id).first()
        if new_acc:
            if payload.type == "income":
                new_acc.balance += payload.amount
            else:
                new_acc.balance -= payload.amount
                
    db.commit()
    db.refresh(tx)
    return {"ok": True, "transaction": tx}

@app.delete("/api/transactions/{id}")
async def delete_transaction(id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    tx = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == user_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
        
    # Revertir saldo de la cuenta asociada
    if tx.account_id:
        acc = db.query(Account).filter(Account.id == tx.account_id, Account.user_id == user_id).first()
        if acc:
            if tx.type == "income":
                acc.balance -= tx.amount
            else:
                acc.balance += tx.amount
                
    db.delete(tx)
    db.commit()
    return {"ok": True, "message": "Transacción eliminada"}


# --- BUDGETS ---
@app.get("/api/budgets")
async def get_budgets(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    bgts = db.query(Budget).filter(Budget.user_id == user_id).all()
    return {"ok": True, "budgets": bgts}

@app.post("/api/budgets", status_code=201)
async def create_budget(payload: BudgetCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    new_bgt = Budget(
        user_id=user_id,
        cat=payload.cat,
        name=payload.name.strip(),
        icon=payload.icon,
        limit=payload.limit,
        color=payload.color,
        notes=payload.notes.strip() if payload.notes else None
    )
    db.add(new_bgt)
    db.commit()
    db.refresh(new_bgt)
    return {"ok": True, "budget": new_bgt}

@app.put("/api/budgets/{id}")
async def update_budget(id: int, payload: BudgetCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    bgt = db.query(Budget).filter(Budget.id == id, Budget.user_id == user_id).first()
    if not bgt:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        
    bgt.cat = payload.cat
    bgt.name = payload.name.strip()
    bgt.icon = payload.icon
    bgt.limit = payload.limit
    bgt.color = payload.color
    bgt.notes = payload.notes.strip() if payload.notes else None
    
    db.commit()
    db.refresh(bgt)
    return {"ok": True, "budget": bgt}

@app.delete("/api/budgets/{id}")
async def delete_budget(id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    bgt = db.query(Budget).filter(Budget.id == id, Budget.user_id == user_id).first()
    if not bgt:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        
    db.delete(bgt)
    db.commit()
    return {"ok": True, "message": "Presupuesto eliminado"}


# --- GOALS & CONTRIBUTIONS ---
@app.get("/api/goals")
async def get_goals(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    gls = db.query(Goal).filter(Goal.user_id == user_id).all()
    
    # Construir respuesta con las contribuciones incluidas
    result = []
    for g in gls:
        contribs = db.query(GoalContribution).filter(GoalContribution.goal_id == g.id).order_by(GoalContribution.date.asc()).all()
        result.append({
            "id": g.id,
            "name": g.name,
            "cat": g.cat,
            "emoji": g.emoji,
            "color": g.color,
            "target": g.target,
            "current": g.current,
            "deadline": g.deadline,
            "notes": g.notes,
            "status": g.status,
            "contributions": contribs
        })
    return {"ok": True, "goals": result}

@app.post("/api/goals", status_code=201)
async def create_goal(payload: GoalCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    new_goal = Goal(
        user_id=user_id,
        name=payload.name.strip(),
        cat=payload.cat,
        emoji=payload.emoji,
        color=payload.color,
        target=payload.target,
        current=payload.current,
        deadline=payload.deadline if payload.deadline else None,
        notes=payload.notes.strip() if payload.notes else None,
        status=payload.status
    )
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)
    return {"ok": True, "goal": {
        "id": new_goal.id,
        "name": new_goal.name,
        "cat": new_goal.cat,
        "emoji": new_goal.emoji,
        "color": new_goal.color,
        "target": new_goal.target,
        "current": new_goal.current,
        "deadline": new_goal.deadline,
        "notes": new_goal.notes,
        "status": new_goal.status,
        "contributions": []
    }}

@app.put("/api/goals/{id}")
async def update_goal(id: int, payload: GoalCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    g = db.query(Goal).filter(Goal.id == id, Goal.user_id == user_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Objetivo no encontrado")
        
    g.name = payload.name.strip()
    g.cat = payload.cat
    g.emoji = payload.emoji
    g.color = payload.color
    g.target = payload.target
    g.current = payload.current
    g.deadline = payload.deadline if payload.deadline else None
    g.notes = payload.notes.strip() if payload.notes else None
    g.status = payload.status
    
    db.commit()
    db.refresh(g)
    
    contribs = db.query(GoalContribution).filter(GoalContribution.goal_id == g.id).order_by(GoalContribution.date.asc()).all()
    return {"ok": True, "goal": {
        "id": g.id,
        "name": g.name,
        "cat": g.cat,
        "emoji": g.emoji,
        "color": g.color,
        "target": g.target,
        "current": g.current,
        "deadline": g.deadline,
        "notes": g.notes,
        "status": g.status,
        "contributions": contribs
    }}

@app.delete("/api/goals/{id}")
async def delete_goal(id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    g = db.query(Goal).filter(Goal.id == id, Goal.user_id == user_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Objetivo no encontrado")
        
    # Eliminar contribuciones de este objetivo
    db.query(GoalContribution).filter(GoalContribution.goal_id == id).delete()
    
    db.delete(g)
    db.commit()
    return {"ok": True, "message": "Objetivo eliminado"}

@app.post("/api/goals/{id}/contributions", status_code=201)
async def add_goal_contribution(id: int, payload: GoalContributionCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    g = db.query(Goal).filter(Goal.id == id, Goal.user_id == user_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Objetivo no encontrado")
        
    new_contrib = GoalContribution(
        goal_id=id,
        amount=payload.amount,
        date=payload.date,
        note=payload.note.strip() if payload.note else None
    )
    db.add(new_contrib)
    
    # Actualizar saldo actual del objetivo
    g.current += payload.amount
    
    db.commit()
    db.refresh(new_contrib)
    db.refresh(g)
    
    contribs = db.query(GoalContribution).filter(GoalContribution.goal_id == g.id).order_by(GoalContribution.date.asc()).all()
    return {"ok": True, "goal": {
        "id": g.id,
        "name": g.name,
        "cat": g.cat,
        "emoji": g.emoji,
        "color": g.color,
        "target": g.target,
        "current": g.current,
        "deadline": g.deadline,
        "notes": g.notes,
        "status": g.status,
        "contributions": contribs
    }}

@app.delete("/api/goals/{goal_id}/contributions/{contrib_id}")
async def delete_goal_contribution(goal_id: int, contrib_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    g = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Objetivo no encontrado")
        
    contrib = db.query(GoalContribution).filter(GoalContribution.id == contrib_id, GoalContribution.goal_id == goal_id).first()
    if not contrib:
        raise HTTPException(status_code=404, detail="Contribución no encontrada")
        
    # Actualizar saldo actual del objetivo
    g.current = max(g.current - contrib.amount, 0.0)
    
    db.delete(contrib)
    db.commit()
    db.refresh(g)
    
    contribs = db.query(GoalContribution).filter(GoalContribution.goal_id == g.id).order_by(GoalContribution.date.asc()).all()
    return {"ok": True, "goal": {
        "id": g.id,
        "name": g.name,
        "cat": g.cat,
        "emoji": g.emoji,
        "color": g.color,
        "target": g.target,
        "current": g.current,
        "deadline": g.deadline,
        "notes": g.notes,
        "status": g.status,
        "contributions": contribs
    }}



# ============================================================
#  SERVING STATIC FILES (Frontend Monolith)
# ============================================================
# Obtener la ruta base absoluta del proyecto (subiendo un nivel desde la carpeta api/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Montar directorios de archivos estáticos
app.mount("/js", StaticFiles(directory=os.path.join(BASE_DIR, "js")), name="js")
app.mount("/css", StaticFiles(directory=os.path.join(BASE_DIR, "css")), name="css")
app.mount("/mds", StaticFiles(directory=os.path.join(BASE_DIR, "mds")), name="mds")
app.mount("/data", StaticFiles(directory=os.path.join(BASE_DIR, "data")), name="data")
app.mount("/tests", StaticFiles(directory=os.path.join(BASE_DIR, "tests")), name="tests")

# Rutas para servir las páginas principales del frontend
@app.get("/", response_class=FileResponse)
async def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/index.html", response_class=FileResponse)
async def serve_index_html():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/main.html", response_class=FileResponse)
async def serve_main():
    return FileResponse(os.path.join(BASE_DIR, "main.html"))
