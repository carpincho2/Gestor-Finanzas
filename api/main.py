import os
import re
import json
import time
import hashlib
import secrets
import requests
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Request, Response, Query
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Index, Float, func
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from google import genai
from google.genai import types
from google.genai.errors import APIError
from cryptography.fernet import Fernet, InvalidToken

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
#  TOKEN ENCRYPTION SERVICE (Fernet AES-128-CBC + HMAC)
# ============================================================
# Los tokens OAuth de billeteras virtuales (Mercado Pago, Plaid, etc.)
# se cifran antes de guardarlos en la base de datos. Esto garantiza que
# si alguien accede a la BD, no puede leer los tokens en texto plano.
#
# Fernet usa:
#   - AES-128-CBC para cifrado (confidencialidad)
#   - HMAC-SHA256 para autenticación (integridad / anti-tampering)
#
# La clave se lee de la variable de entorno ENCRYPTION_KEY.
# Si no existe, se auto-genera (solo útil para desarrollo local).

class TokenEncryptionService:
    """Servicio de cifrado simétrico para tokens OAuth usando Fernet."""

    def __init__(self):
        key = os.getenv("ENCRYPTION_KEY", "").strip()
        if not key:
            # Auto-generar clave y advertir (solo para desarrollo local)
            key = Fernet.generate_key().decode()
            os.environ["ENCRYPTION_KEY"] = key
            print("⚠️  ENCRYPTION_KEY auto-generada para desarrollo local.")
            print("   Para producción, generala con:")
            print('   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"')
        self._fernet = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt(self, plaintext: str) -> str:
        """Cifra un texto plano y devuelve el ciphertext en base64."""
        if not plaintext:
            return ""
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        """Descifra un ciphertext base64 y devuelve el texto original."""
        if not ciphertext:
            return ""
        try:
            return self._fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            # Si el token no se puede descifrar (clave cambiada o dato corrupto),
            # retornamos el valor tal cual (podría ser un token en texto plano
            # de la migración antigua que aún no fue cifrado).
            return ciphertext

    def is_encrypted(self, value: str) -> bool:
        """Detecta si un valor ya está cifrado con Fernet."""
        if not value:
            return False
        try:
            self._fernet.decrypt(value.encode("utf-8"))
            return True
        except Exception:
            return False

# Instancia global del servicio de cifrado
token_crypto = TokenEncryptionService()

# Variables de Mercado Pago OAuth 2.0
MP_CLIENT_ID = os.getenv("MP_CLIENT_ID", "")
MP_CLIENT_SECRET = os.getenv("MP_CLIENT_SECRET", "")
MP_REDIRECT_URI = os.getenv("MP_REDIRECT_URI", "http://localhost:8000/api/wallets/mercadopago/callback")

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
    mp_token = Column(String(500), nullable=True)  # Token de acceso de Mercado Pago
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

# ============================================================
#  WALLET CONNECTION & SYNC LOG MODELS (Fase 2-3)
# ============================================================

class WalletConnection(Base):
    """
    Conexión de billetera virtual de un usuario.
    
    Almacena los tokens OAuth cifrados con Fernet y el estado
    de la conexión. Cada cuenta puede tener una conexión de billetera.
    """
    __tablename__ = "wallet_connections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False)
    account_id = Column(Integer, index=True, nullable=False)     # Cuenta asociada en Flujo
    provider = Column(String(50), nullable=False)                 # 'mercadopago', 'plaid', 'belvo'
    provider_user_id = Column(String(255), nullable=True)         # ID del usuario en el proveedor
    access_token_encrypted = Column(String(1000), nullable=True)  # Token cifrado con Fernet
    refresh_token_encrypted = Column(String(1000), nullable=True) # Refresh token cifrado
    token_expires_at = Column(DateTime, nullable=True)            # Expiración del access token
    status = Column(String(20), default="active")                 # active, expired, revoked, error
    last_sync_at = Column(DateTime, nullable=True)                # Última sincronización exitosa
    last_sync_status = Column(String(20), nullable=True)          # success, error, partial
    last_sync_error = Column(String(500), nullable=True)          # Descripción del último error
    created_at = Column(DateTime, server_default=func.now())

class SyncLog(Base):
    """
    Registro de auditoría de cada sincronización.
    
    Permite al usuario ver el historial de sincronizaciones y
    diagnosticar problemas si una sincronización falla.
    """
    __tablename__ = "sync_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    wallet_connection_id = Column(Integer, index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=False)
    provider = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)                   # success, error, partial
    transactions_imported = Column(Integer, default=0)
    transactions_skipped = Column(Integer, default=0)             # Duplicados ignorados
    error_message = Column(String(500), nullable=True)
    duration_ms = Column(Integer, nullable=True)                  # Duración en milisegundos
    created_at = Column(DateTime, server_default=func.now())

# Auto-create tables (SQLite and PostgreSQL)
Base.metadata.create_all(bind=engine)

# ============================================================
#  MIGRACIÓN AUTOMÁTICA: Cifrar tokens en texto plano existentes
# ============================================================
def migrate_plaintext_tokens():
    """
    Al arrancar el servidor, busca tokens de Mercado Pago guardados
    en texto plano en la tabla accounts (columna mp_token) y los
    migra a la nueva tabla wallet_connections con cifrado Fernet.
    
    También cifra los tokens que ya están en mp_token pero sin cifrar.
    Esta función es idempotente: puede ejecutarse múltiples veces
    sin duplicar datos.
    """
    db = SessionLocal()
    try:
        migrated = 0
        accs_with_token = db.query(Account).filter(Account.mp_token.isnot(None), Account.mp_token != "").all()
        for acc in accs_with_token:
            token_value = acc.mp_token.strip()
            if not token_value:
                continue

            # Verificar si ya existe una WalletConnection para esta cuenta
            existing = db.query(WalletConnection).filter(
                WalletConnection.account_id == acc.id,
                WalletConnection.user_id == acc.user_id,
                WalletConnection.provider == "mercadopago"
            ).first()

            if existing:
                continue  # Ya migrado

            # Cifrar el token y crear la conexión
            encrypted_token = token_crypto.encrypt(token_value) if not token_crypto.is_encrypted(token_value) else token_value

            new_conn = WalletConnection(
                user_id=acc.user_id,
                account_id=acc.id,
                provider="mercadopago",
                access_token_encrypted=encrypted_token,
                status="active",
            )
            db.add(new_conn)
            migrated += 1

        if migrated > 0:
            db.commit()
            print(f"✅ Migración completada: {migrated} token(s) cifrados y migrados a wallet_connections.")
    except Exception as e:
        db.rollback()
        print(f"⚠️  Error en migración de tokens: {e}")
    finally:
        db.close()

# Ejecutar migración al arrancar
migrate_plaintext_tokens()

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

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

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
    mp_token: Optional[str] = None

class AccountUpdate(BaseModel):
    name: str
    type: str
    bank: Optional[str] = None
    balance: float
    currency: str = "ARS"
    limit: float = 0.0
    notes: Optional[str] = None
    mp_token: Optional[str] = None

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
    
    def is_strong_password(p: str) -> bool:
        if len(p) < 8: return False
        if not re.search(r"[A-Za-z]", p): return False
        if not re.search(r"[0-9]", p): return False
        return True
        
    if not is_strong_password(payload.new_password):
        return JSONResponse(status_code=422, content={"error": "La contraseña debe tener al menos 8 caracteres y contener letras y números"})
    
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(payload.new_password.encode("utf-8"), salt).decode("utf-8")
    user.password_hash = hashed_password
    db.commit()
    
    return {"ok": True, "message": "Contraseña actualizada correctamente"}

# ============================================================
#  SECURITY: Rate Limiting & Anti-Timing Attacks para Login
# ============================================================
import time

_login_attempts = {}
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_TIME_SECS = 300  # 5 minutos

# Dummy hash generado con bcrypt para igualar tiempos (aprox 100ms)
DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"dummy_password_for_timing_attack_prevention", bcrypt.gensalt())

@app.post("/api/auth/login")
async def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    current_time = time.time()
    
    # 1. Check Rate Limiting
    if client_ip in _login_attempts:
        attempts, first_attempt_time = _login_attempts[client_ip]
        if current_time - first_attempt_time > LOCKOUT_TIME_SECS:
            _login_attempts[client_ip] = (0, current_time)
        elif attempts >= MAX_LOGIN_ATTEMPTS:
            return JSONResponse(status_code=429, content={"error": "Demasiados intentos. Por favor, esperá 5 minutos."})
    
    email = payload.email.strip()
    password = payload.password
    
    if not email or not password:
        return JSONResponse(status_code=422, content={"error": "Email y contraseña son requeridos"})
        
    user = db.query(User).filter(User.email == email).first()
    
    # 2. Anti-Timing Attack: Siempre verificar un hash, exista o no el usuario.
    # Si el usuario existe y tiene hash, usamos ese. Si no, usamos el dummy.
    hash_to_check = user.password_hash.encode("utf-8") if user and user.password_hash else DUMMY_PASSWORD_HASH
    
    try:
        is_valid = bcrypt.checkpw(password.encode("utf-8"), hash_to_check)
    except Exception:
        is_valid = False
        
    # Validamos si es un usuario válido real
    if not user or not user.password_hash or not is_valid:
        # Registrar intento fallido
        if client_ip in _login_attempts:
            attempts, first_time = _login_attempts[client_ip]
            if current_time - first_time > LOCKOUT_TIME_SECS:
                _login_attempts[client_ip] = (1, current_time)
            else:
                _login_attempts[client_ip] = (attempts + 1, first_time)
        else:
            _login_attempts[client_ip] = (1, current_time)
            
        return JSONResponse(status_code=401, content={"error": "Email o contraseña incorrectos"})
        
    # Éxito: Limpiar intentos
    if client_ip in _login_attempts:
        del _login_attempts[client_ip]
        
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
        
    def is_strong_password(p: str) -> bool:
        if len(p) < 8: return False
        if not re.search(r"[A-Za-z]", p): return False
        if not re.search(r"[0-9]", p): return False
        return True
        
    if not is_strong_password(password):
        return JSONResponse(status_code=422, content={"error": "La contraseña debe tener al menos 8 caracteres y contener letras y números"})
        
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
        notes=payload.notes.strip() if payload.notes else None,
        mp_token=payload.mp_token.strip() if payload.mp_token else None
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
    acc.mp_token = payload.mp_token.strip() if payload.mp_token else None
    
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
    db.query(Transaction).filter(
        Transaction.account_id == id, 
        Transaction.user_id == user_id
    ).update({Transaction.account_id: None})
    
    db.delete(acc)
    db.commit()
    return {"ok": True, "message": "Cuenta eliminada"}

class AccountTokenRequest(BaseModel):
    mp_token: str

@app.put("/api/accounts/{id}/token")
async def update_account_token(id: int, payload: AccountTokenRequest, request: Request, db: Session = Depends(get_db)):
    """
    Guarda el token de Mercado Pago cifrado con Fernet.
    
    Este endpoint mantiene compatibilidad con el flujo manual de token
    (para modo mock/pruebas), pero ahora cifra el token antes de guardarlo.
    También crea o actualiza la entrada en wallet_connections.
    """
    user_id = get_current_user_id(request)
    acc = db.query(Account).filter(Account.id == id, Account.user_id == user_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    token_value = payload.mp_token.strip()
    
    # Cifrar el token (excepto tokens de prueba que se guardan tal cual para mock)
    is_mock = token_value.lower() in ["mock-token", "test-token", "pruebas"]
    encrypted_token = token_value if is_mock else token_crypto.encrypt(token_value)
    
    # Guardar en la tabla legacy (compatibilidad)
    acc.mp_token = encrypted_token
    
    # Crear o actualizar WalletConnection
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == id,
        WalletConnection.user_id == user_id,
        WalletConnection.provider == "mercadopago"
    ).first()
    
    if wallet_conn:
        wallet_conn.access_token_encrypted = encrypted_token
        wallet_conn.status = "active"
    else:
        wallet_conn = WalletConnection(
            user_id=user_id,
            account_id=id,
            provider="mercadopago",
            access_token_encrypted=encrypted_token,
            status="active",
        )
        db.add(wallet_conn)
    
    db.commit()
    db.refresh(acc)
    return {"ok": True, "message": "Token de Mercado Pago actualizado correctamente"}

@app.post("/api/accounts/{id}/sync")
async def sync_account_transactions(id: int, request: Request, db: Session = Depends(get_db)):
    """
    Sincroniza transacciones de la billetera virtual conectada.
    
    Usa el adaptador de Mercado Pago del patrón Adapter para:
    1. Descifrar el token de acceso
    2. Verificar si necesita refresco automático
    3. Obtener transacciones normalizadas
    4. Prevenir duplicados
    5. Actualizar balance de la cuenta
    6. Registrar la sincronización en sync_log
    """
    import time as _time
    sync_start = _time.time()
    
    user_id = get_current_user_id(request)
    acc = db.query(Account).filter(Account.id == id, Account.user_id == user_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    # Buscar la conexión de billetera (primero en wallet_connections, luego fallback a mp_token)
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == id,
        WalletConnection.user_id == user_id,
        WalletConnection.provider == "mercadopago"
    ).first()
    
    # Obtener el token (descifrado)
    token = ""
    if wallet_conn and wallet_conn.access_token_encrypted:
        token = token_crypto.decrypt(wallet_conn.access_token_encrypted)
    elif acc.mp_token:
        token = token_crypto.decrypt(acc.mp_token)
    
    if not token:
        # Fallback a variable de entorno
        token = os.getenv("MP_ACCESS_TOKEN", "").strip()
        
    if not token:
        return JSONResponse(status_code=400, content={"error": "Token de acceso de Mercado Pago no configurado para esta cuenta"})
    
    # Verificar si el token necesita refresco automático
    if wallet_conn and wallet_conn.token_expires_at:
        time_until_expiry = wallet_conn.token_expires_at - datetime.utcnow()
        if time_until_expiry.total_seconds() < 600:  # Menos de 10 minutos
            # Intentar refrescar el token automáticamente
            if wallet_conn.refresh_token_encrypted:
                try:
                    from wallet_adapters.mercadopago_adapter import MercadoPagoAdapter
                    adapter = MercadoPagoAdapter()
                    refresh_token = token_crypto.decrypt(wallet_conn.refresh_token_encrypted)
                    new_tokens = adapter.refresh_access_token(refresh_token)
                    
                    # Actualizar tokens cifrados
                    wallet_conn.access_token_encrypted = token_crypto.encrypt(new_tokens["access_token"])
                    wallet_conn.refresh_token_encrypted = token_crypto.encrypt(new_tokens.get("refresh_token", refresh_token))
                    wallet_conn.token_expires_at = datetime.utcnow() + timedelta(seconds=new_tokens.get("expires_in", 21600))
                    wallet_conn.status = "active"
                    token = new_tokens["access_token"]
                    db.commit()
                    print(f"🔄 Token renovado automáticamente para cuenta {id}")
                except Exception as e:
                    print(f"⚠️ Error al renovar token: {e}")
                    wallet_conn.status = "expired"
                    db.commit()
    
    user = db.query(User).filter(User.id == user_id).first()
    user_email = user.email if user else ""
    
    # Usar el adaptador de Mercado Pago para obtener transacciones normalizadas
    try:
        from wallet_adapters.mercadopago_adapter import MercadoPagoAdapter
        adapter = MercadoPagoAdapter()
        
        # Determinar fecha desde la última sincronización
        if wallet_conn and wallet_conn.last_sync_at:
            since_date = wallet_conn.last_sync_at.strftime("%Y-%m-%d")
        else:
            # Si es la primera vez que sincroniza, traer solo los últimos 30 días
            since_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        normalized_txs = adapter.fetch_transactions(
            access_token=token,
            since_date=since_date,
            user_email=user_email,
        )
    except Exception as e:
        error_msg = str(e)
        # Registrar error en sync_log
        if wallet_conn:
            sync_duration = int((_time.time() - sync_start) * 1000)
            log_entry = SyncLog(
                wallet_connection_id=wallet_conn.id,
                user_id=user_id,
                provider="mercadopago",
                status="error",
                error_message=error_msg[:500],
                duration_ms=sync_duration,
            )
            db.add(log_entry)
            wallet_conn.last_sync_status = "error"
            wallet_conn.last_sync_error = error_msg[:500]
            db.commit()
        
        if "TOKEN_EXPIRED" in error_msg:
            return JSONResponse(status_code=401, content={"error": "El token de Mercado Pago expiró. Reconectá tu billetera."})
        return JSONResponse(status_code=502, content={"error": f"Error al sincronizar con Mercado Pago: {error_msg}"})
    
    # Procesar transacciones normalizadas
    imported_count = 0
    skipped_count = 0
    
    for ntx in normalized_txs:
        # Prevención de duplicados: buscar si ya existe
        existing = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.account_id == id,
            Transaction.amount == ntx.amount,
            Transaction.date == ntx.date,
            Transaction.desc == ntx.description
        ).first()
        
        if existing:
            skipped_count += 1
            continue
            
        # Crear la transacción
        new_tx = Transaction(
            user_id=user_id,
            account_id=id,
            type=ntx.type,
            desc=ntx.description,
            amount=ntx.amount,
            cat=ntx.category_hint,
            date=ntx.date
        )
        db.add(new_tx)
        imported_count += 1
    
    # ── ACTUALIZAR SALDO ──
    # Estrategia: intentar obtener el saldo real de la API de MP.
    # Si la API falla (común en cuentas personales), ajustamos el saldo
    # sumando/restando SOLO las transacciones nuevas importadas en ESTE sync
    # (las que no existían antes en la BD = no fueron skipped).
    balance_updated = False
    try:
        balance_info = adapter.fetch_balance(access_token=token)
        if balance_info and "available_balance" in balance_info:
            acc.balance = balance_info["available_balance"]
            balance_updated = True
            print(f"✅ Saldo real de MP obtenido: ${acc.balance:,.2f}")
    except Exception as balance_err:
        print(f"⚠️ No se pudo obtener saldo de MP vía API: {balance_err}")
    
    if not balance_updated and imported_count > 0:
        # Ajuste incremental: solo sumar/restar las transacciones NUEVAS
        for ntx in normalized_txs:
            existing = db.query(Transaction).filter(
                Transaction.user_id == user_id,
                Transaction.account_id == id,
                Transaction.amount == ntx.amount,
                Transaction.date == ntx.date,
                Transaction.desc == ntx.description
            ).count()
            # Si existe más de 1, significa que ya estaba antes + la que acabamos de crear
            # Si existe exactamente 1, es la que acabamos de crear (nueva)
            if existing > 1:
                continue
            if ntx.type == "income":
                acc.balance += ntx.amount
            else:
                acc.balance -= ntx.amount
        print(f"📊 Saldo ajustado incrementalmente: ${acc.balance:,.2f} ({imported_count} tx nuevas)")
    
    # Registrar sincronización exitosa
    sync_duration = int((_time.time() - sync_start) * 1000)
    if wallet_conn:
        wallet_conn.last_sync_at = datetime.utcnow()
        wallet_conn.last_sync_status = "success"
        wallet_conn.last_sync_error = None
        
        log_entry = SyncLog(
            wallet_connection_id=wallet_conn.id,
            user_id=user_id,
            provider="mercadopago",
            status="success",
            transactions_imported=imported_count,
            transactions_skipped=skipped_count,
            duration_ms=sync_duration,
        )
        db.add(log_entry)
    
    db.commit()
    return {"ok": True, "imported_count": imported_count, "skipped_count": skipped_count, "balance": acc.balance}


# ============================================================
#  WALLET BALANCE ENDPOINT (Consultar saldo real de MP)
# ============================================================

@app.get("/api/wallets/mercadopago/balance/{account_id}")
async def mp_get_balance(account_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Intenta obtener el saldo real de MP vía API.
    Si la API falla (común en cuentas personales), devuelve el saldo de la BD.
    """
    user_id = get_current_user_id(request)
    acc = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    # Buscar token
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == account_id,
        WalletConnection.user_id == user_id,
        WalletConnection.provider == "mercadopago"
    ).first()
    
    token = ""
    if wallet_conn and wallet_conn.access_token_encrypted:
        token = token_crypto.decrypt(wallet_conn.access_token_encrypted)
    elif acc.mp_token:
        token = token_crypto.decrypt(acc.mp_token)
    
    if not token:
        # Sin token: devolver saldo de la BD directamente
        return {"ok": True, "balance": acc.balance, "total_balance": acc.balance, "currency": acc.currency or "ARS"}
    
    try:
        from wallet_adapters.mercadopago_adapter import MercadoPagoAdapter
        adapter = MercadoPagoAdapter()
        balance_info = adapter.fetch_balance(access_token=token)
        
        if balance_info and "available_balance" in balance_info:
            acc.balance = balance_info["available_balance"]
            db.commit()
            print(f"✅ Saldo real de MP obtenido vía API: ${acc.balance:,.2f}")
            return {
                "ok": True,
                "balance": acc.balance,
                "total_balance": balance_info.get("total_balance", acc.balance),
                "currency": balance_info.get("currency", "ARS"),
            }
    except Exception as e:
        print(f"⚠️ fetch_balance falló: {e}")
    
    # Fallback: devolver el saldo actual de la BD sin error
    return {"ok": True, "balance": acc.balance, "total_balance": acc.balance, "currency": acc.currency or "ARS"}


# ============================================================
#  WALLET OAUTH 2.0 ENDPOINTS (Fase 2)
# ============================================================

@app.get("/api/wallets/mercadopago/connect")
async def mp_connect(request: Request, account_id: int = Query(...)):
    """
    Inicia el flujo OAuth 2.0 de Mercado Pago.
    
    1. Genera un par PKCE (code_verifier + code_challenge)
    2. Guarda el verifier y el account_id en la sesión
    3. Redirige al usuario a la página de login de Mercado Pago
    
    El usuario autoriza la app y MP redirige de vuelta a /callback.
    """
    user_id = get_current_user_id(request)
    
    if not MP_CLIENT_ID:
        return JSONResponse(status_code=500, content={
            "error": "MP_CLIENT_ID no configurado. Creá una app en https://www.mercadopago.com/developers"
        })
    
    from wallet_adapters.mercadopago_adapter import MercadoPagoAdapter, generate_pkce_pair
    
    # Generar PKCE y state anti-CSRF
    code_verifier, code_challenge = generate_pkce_pair()
    state = secrets.token_urlsafe(32)
    
    # Guardar en sesión para verificar en el callback
    request.session["oauth_state"] = state
    request.session["oauth_verifier"] = code_verifier
    request.session["oauth_account_id"] = account_id
    
    adapter = MercadoPagoAdapter()
    auth_url = adapter.get_auth_url(
        state=state,
        redirect_uri=MP_REDIRECT_URI,
        code_challenge=code_challenge,
    )
    
    return RedirectResponse(url=auth_url, status_code=302)

@app.get("/api/wallets/mercadopago/callback")
async def mp_callback(request: Request, code: str = "", state: str = "", error: str = "", db: Session = Depends(get_db)):
    """
    Callback de OAuth 2.0 de Mercado Pago.
    
    Recibe el código de autorización, lo intercambia por tokens,
    los cifra con Fernet y los guarda en wallet_connections.
    Luego redirige al usuario de vuelta a la app.
    """
    # Redirigir a la app si hay error
    if error:
        return RedirectResponse(url="/main.html#cuentas?wallet_error=access_denied", status_code=302)
    
    # Validar state anti-CSRF
    saved_state = request.session.get("oauth_state", "")
    if state != saved_state:
        return RedirectResponse(url="/main.html#cuentas?wallet_error=csrf_invalid", status_code=302)
    
    user_id = request.session.get("user_id")
    if not user_id:
        return RedirectResponse(url="/index.html", status_code=302)
    
    account_id = request.session.get("oauth_account_id")
    code_verifier = request.session.get("oauth_verifier", "")
    
    # Limpiar datos de sesión OAuth
    for key in ["oauth_state", "oauth_verifier", "oauth_account_id"]:
        request.session.pop(key, None)
    
    try:
        from wallet_adapters.mercadopago_adapter import MercadoPagoAdapter
        adapter = MercadoPagoAdapter()
        
        # Intercambiar code por tokens
        tokens = adapter.exchange_code(
            code=code,
            redirect_uri=MP_REDIRECT_URI,
            code_verifier=code_verifier,
        )
        
        # Cifrar tokens
        access_encrypted = token_crypto.encrypt(tokens["access_token"])
        refresh_encrypted = token_crypto.encrypt(tokens.get("refresh_token", ""))
        expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 21600))
        
        # Crear o actualizar WalletConnection
        wallet_conn = db.query(WalletConnection).filter(
            WalletConnection.account_id == account_id,
            WalletConnection.user_id == user_id,
            WalletConnection.provider == "mercadopago"
        ).first()
        
        if wallet_conn:
            wallet_conn.access_token_encrypted = access_encrypted
            wallet_conn.refresh_token_encrypted = refresh_encrypted
            wallet_conn.token_expires_at = expires_at
            wallet_conn.provider_user_id = tokens.get("provider_user_id", "")
            wallet_conn.status = "active"
        else:
            wallet_conn = WalletConnection(
                user_id=user_id,
                account_id=account_id,
                provider="mercadopago",
                provider_user_id=tokens.get("provider_user_id", ""),
                access_token_encrypted=access_encrypted,
                refresh_token_encrypted=refresh_encrypted,
                token_expires_at=expires_at,
                status="active",
            )
            db.add(wallet_conn)
        
        # También actualizar mp_token en la tabla accounts (compatibilidad)
        acc = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
        if acc:
            acc.mp_token = access_encrypted
        
        db.commit()
        return RedirectResponse(url="/main.html#cuentas?wallet_connected=1", status_code=302)
        
    except Exception as e:
        print(f"❌ Error en OAuth callback de MP: {e}")
        return RedirectResponse(url=f"/main.html#cuentas?wallet_error=exchange_failed", status_code=302)

@app.post("/api/wallets/mercadopago/disconnect/{account_id}")
async def mp_disconnect(account_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Desconecta la billetera de Mercado Pago de una cuenta.
    
    Elimina los tokens cifrados de la BD y marca la conexión como revocada.
    """
    user_id = get_current_user_id(request)
    
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == account_id,
        WalletConnection.user_id == user_id,
        WalletConnection.provider == "mercadopago"
    ).first()
    
    if wallet_conn:
        wallet_conn.access_token_encrypted = None
        wallet_conn.refresh_token_encrypted = None
        wallet_conn.status = "revoked"
        wallet_conn.token_expires_at = None
    
    # Limpiar token legacy de la tabla accounts
    acc = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
    if acc:
        acc.mp_token = None
    
    db.commit()
    return {"ok": True, "message": "Billetera de Mercado Pago desconectada"}

@app.get("/api/wallets/status/{account_id}")
async def wallet_status(account_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Devuelve el estado de conexión de la billetera para una cuenta.
    
    El frontend usa esto para mostrar si la billetera está conectada,
    expirada o desconectada, y la fecha de la última sincronización.
    """
    user_id = get_current_user_id(request)
    
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == account_id,
        WalletConnection.user_id == user_id,
    ).first()
    
    if not wallet_conn:
        # Verificar si hay token legacy en la cuenta
        acc = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
        has_legacy_token = bool(acc and acc.mp_token)
        return {
            "ok": True,
            "connected": has_legacy_token,
            "provider": "mercadopago" if has_legacy_token else None,
            "status": "active" if has_legacy_token else "disconnected",
            "is_oauth": False,
            "last_sync_at": None,
            "last_sync_status": None,
            "last_sync_error": None,
        }
    
    return {
        "ok": True,
        "connected": wallet_conn.status == "active",
        "provider": wallet_conn.provider,
        "status": wallet_conn.status,
        "is_oauth": bool(wallet_conn.refresh_token_encrypted),
        "last_sync_at": wallet_conn.last_sync_at.isoformat() if wallet_conn.last_sync_at else None,
        "last_sync_status": wallet_conn.last_sync_status,
        "last_sync_error": wallet_conn.last_sync_error,
    }

@app.get("/api/wallets/{account_id}/sync-history")
async def wallet_sync_history(account_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Devuelve el historial de sincronizaciones de una cuenta.
    Útil para que el usuario vea cuándo fue la última sync y si hubo errores.
    """
    user_id = get_current_user_id(request)
    
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == account_id,
        WalletConnection.user_id == user_id,
    ).first()
    
    if not wallet_conn:
        return {"ok": True, "history": []}
    
    logs = db.query(SyncLog).filter(
        SyncLog.wallet_connection_id == wallet_conn.id
    ).order_by(SyncLog.created_at.desc()).limit(10).all()
    
    return {
        "ok": True,
        "history": [
            {
                "id": log.id,
                "status": log.status,
                "imported": log.transactions_imported,
                "skipped": log.transactions_skipped,
                "error": log.error_message,
                "duration_ms": log.duration_ms,
                "date": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
    }


# ============================================================
#  WEBHOOK DE MERCADO PAGO (Fase 4 - IPN)
# ============================================================

@app.post("/api/webhooks/mercadopago")
async def mp_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Recibe notificaciones IPN (Instant Payment Notification) de Mercado Pago.
    
    Cuando un usuario realiza o recibe un pago, MP envía una notificación
    HTTP POST a esta URL. El webhook:
    1. Valida la firma HMAC del mensaje (seguridad)
    2. Busca la wallet_connection asociada al usuario de MP
    3. Ejecuta una sincronización automática
    
    Configuración en MP Developers:
        URL de notificación: https://tu-dominio.com/api/webhooks/mercadopago
        Eventos: payment
    """
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})
    
    # Verificar firma HMAC si hay secret configurado
    mp_secret = os.getenv("MP_WEBHOOK_SECRET", "")
    if mp_secret:
        x_signature = request.headers.get("x-signature", "")
        x_request_id = request.headers.get("x-request-id", "")
        
        if not x_signature:
            return JSONResponse(status_code=401, content={"error": "Missing signature"})
            
        # Validar la firma HMAC-SHA256
        # Extraer ts y v1 de la firma
        parts = dict(p.split("=", 1) for p in x_signature.split(",") if "=" in p)
        ts = parts.get("ts", "")
        v1 = parts.get("v1", "")
        
        data_id = body.get("data", {}).get("id", "")
        # Construir el string de verificación
        manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
        
        import hmac
        expected = hmac.new(
            mp_secret.encode("utf-8"),
            manifest.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(v1, expected):
            return JSONResponse(status_code=401, content={"error": "Invalid signature"})
    
    # Procesar la notificación
    action = body.get("action", "")
    data_id = body.get("data", {}).get("id", "")
    user_id_mp = body.get("user_id", "")
    
    if action == "payment.created" and data_id:
        # Buscar la wallet_connection por provider_user_id
        wallet_conn = db.query(WalletConnection).filter(
            WalletConnection.provider == "mercadopago",
            WalletConnection.provider_user_id == str(user_id_mp),
            WalletConnection.status == "active"
        ).first()
        
        if wallet_conn:
            # Registrar que recibimos una notificación (la sincronización se hará en el próximo sync manual o automático)
            wallet_conn.last_sync_error = f"Webhook recibido: payment {data_id}. Sincronizar para importar."
            db.commit()
    
    # MP espera un 200 OK para confirmar recepción
    return {"ok": True}


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
