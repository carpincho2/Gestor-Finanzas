import os
import re
import time
import requests
import bcrypt
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models import User, Account, Transaction, Budget, Goal, GoalContribution, TicketItem
from schemas import (
    LoginRequest, RegisterRequest, GoogleRequest, ProfileUpdateRequest, PasswordChangeRequest
)
from security import DUMMY_PASSWORD_HASH, create_access_token, get_current_user_id

router = APIRouter(prefix="/api/auth", tags=["auth"])

_login_attempts = {}
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_TIME_SECS = 300

@router.get("/me")
async def get_me(request: Request, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    
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

@router.post("/me")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True, "message": "Sesión cerrada"}

@router.delete("/me")
async def delete_me(request: Request, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    
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
        
        db.delete(user)
        db.commit()
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"error": f"Error al eliminar la cuenta: {str(e)}"})
        
    request.session.clear()
    return {"ok": True, "message": "Cuenta eliminada correctamente"}

@router.put("/profile")
async def update_profile(payload: ProfileUpdateRequest, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    
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

@router.put("/password")
async def change_password(payload: PasswordChangeRequest, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    
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

@router.post("/login")
async def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    current_time = time.time()
    
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
    hash_to_check = user.password_hash.encode("utf-8") if user and user.password_hash else DUMMY_PASSWORD_HASH
    
    try:
        is_valid = bcrypt.checkpw(password.encode("utf-8"), hash_to_check)
    except Exception:
        is_valid = False
        
    if not user or not user.password_hash or not is_valid:
        if client_ip in _login_attempts:
            attempts, first_time = _login_attempts[client_ip]
            if current_time - first_time > LOCKOUT_TIME_SECS:
                _login_attempts[client_ip] = (1, current_time)
            else:
                _login_attempts[client_ip] = (attempts + 1, first_time)
        else:
            _login_attempts[client_ip] = (1, current_time)
            
        return JSONResponse(status_code=401, content={"error": "Email o contraseña incorrectos"})
        
    if client_ip in _login_attempts:
        del _login_attempts[client_ip]
        
    request.session["user_id"] = user.id
    request.session["email"] = user.email
    
    # Generar token JWT para Mobile
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    
    return {
        "ok": True,
        "token": access_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar": user.avatar,
            "picture": user.picture
        }
    }

@router.post("/register", status_code=201)
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
        
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        return JSONResponse(status_code=409, content={"error": "Ya existe una cuenta con ese email. Iniciá sesión."})
        
    parts = name.split()
    avatar = (parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper()
    avatar = avatar[:10]
    
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    
    new_user = User(
        name=name,
        email=email,
        password_hash=hashed_password,
        avatar=avatar
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    default_account = Account(
        user_id=new_user.id,
        name="Efectivo",
        type="efectivo",
        balance=0.0,
        currency="ARS"
    )
    db.add(default_account)
    db.commit()
    
    request.session["user_id"] = new_user.id
    request.session["email"] = new_user.email
    
    access_token = create_access_token(data={"sub": str(new_user.id), "email": new_user.email})
    
    return {
        "ok": True,
        "token": access_token,
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "avatar": new_user.avatar,
            "picture": None
        }
    }

@router.post("/google")
async def google_login(request: Request, payload: GoogleRequest, db: Session = Depends(get_db)):
    credential = payload.credential
    if not credential:
        return JSONResponse(status_code=422, content={"error": "Credencial requerida"})
        
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

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    token_aud = token_data.get("aud", "")
    if GOOGLE_CLIENT_ID and token_aud != GOOGLE_CLIENT_ID:
        return JSONResponse(status_code=401, content={"error": "Token de Google no autorizado para esta aplicación."})

    email_verified = token_data.get("email_verified", "false")
    if str(email_verified).lower() != "true":
        return JSONResponse(status_code=401, content={"error": "El email asociado a esta cuenta de Google no está verificado."})
        
    google_id = token_data.get("sub", "")
    email = token_data.get("email", "")
    name = token_data.get("name", email)
    picture = token_data.get("picture")
    
    parts = name.split()
    avatar = (parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper()
    avatar = avatar[:10]
    
    user = db.query(User).filter((User.google_id == google_id) | (User.email == email)).first()
    
    if user:
        user.google_id = google_id
        user.picture = picture
        db.commit()
        db.refresh(user)
    else:
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
        
        default_account = Account(
            user_id=user.id,
            name="Efectivo",
            type="efectivo",
            balance=0.0,
            currency="ARS"
        )
        db.add(default_account)
        db.commit()
        
    request.session["user_id"] = user.id
    request.session["email"] = user.email
    
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    
    return {
        "ok": True,
        "token": access_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar": user.avatar,
            "picture": user.picture
        }
    }
