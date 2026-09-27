import os
import re
import time
import bcrypt
import requests
from sqlalchemy.orm import Session
from fastapi import HTTPException
from models import User, Account, Transaction, Budget, Goal, GoalContribution, TicketItem
from schemas import (
    LoginRequest, RegisterRequest, GoogleRequest, ProfileUpdateRequest, PasswordChangeRequest
)
from security import DUMMY_PASSWORD_HASH, create_access_token

_login_attempts = {}
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_TIME_SECS = 300

class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def get_me(self, user_id: int):
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return user

    def delete_user(self, user_id: int):
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        try:
            self.db.query(Transaction).filter(Transaction.user_id == user_id).delete()
            self.db.query(Budget).filter(Budget.user_id == user_id).delete()
            self.db.query(Account).filter(Account.user_id == user_id).delete()
            
            user_goals = self.db.query(Goal).filter(Goal.user_id == user_id).all()
            for g in user_goals:
                self.db.query(GoalContribution).filter(GoalContribution.goal_id == g.id).delete()
            self.db.query(Goal).filter(Goal.user_id == user_id).delete()
            
            self.db.query(TicketItem).filter(TicketItem.user_id == user_id).delete()
            
            self.db.delete(user)
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Error al eliminar la cuenta: {str(e)}")

    def update_profile(self, user_id: int, payload: ProfileUpdateRequest):
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="El nombre no puede estar vacío")
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        user.name = name
        parts = name.split()
        avatar = (parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper()
        user.avatar = avatar[:10]
        
        self.db.commit()
        self.db.refresh(user)
        return user

    def change_password(self, user_id: int, payload: PasswordChangeRequest):
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        if user.password_hash:
            try:
                is_valid = bcrypt.checkpw(payload.current_password.encode("utf-8"), user.password_hash.encode("utf-8"))
            except Exception:
                is_valid = False
            
            if not is_valid:
                raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
        
        if not self._is_strong_password(payload.new_password):
            raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 8 caracteres y contener letras y números")
        
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(payload.new_password.encode("utf-8"), salt).decode("utf-8")
        user.password_hash = hashed_password
        self.db.commit()

    def login(self, payload: LoginRequest, client_ip: str):
        current_time = time.time()
        
        if client_ip in _login_attempts:
            attempts, first_attempt_time = _login_attempts[client_ip]
            if current_time - first_attempt_time > LOCKOUT_TIME_SECS:
                _login_attempts[client_ip] = (0, current_time)
            elif attempts >= MAX_LOGIN_ATTEMPTS:
                raise HTTPException(status_code=429, detail="Demasiados intentos. Por favor, esperá 5 minutos.")
        
        email = payload.email.strip()
        password = payload.password
        
        if not email or not password:
            raise HTTPException(status_code=422, detail="Email y contraseña son requeridos")
            
        user = self.db.query(User).filter(User.email == email).first()
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
                
            raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
            
        if client_ip in _login_attempts:
            del _login_attempts[client_ip]
            
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
        return user, access_token

    def register(self, payload: RegisterRequest):
        name = payload.name.strip()
        email = payload.email.strip()
        password = payload.password
        
        if not name:
            raise HTTPException(status_code=422, detail="El nombre es requerido")
        if not email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
            raise HTTPException(status_code=422, detail="El email no es válido")
            
        if not self._is_strong_password(password):
            raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 8 caracteres y contener letras y números")
            
        existing_user = self.db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese email. Iniciá sesión.")
            
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
        self.db.add(new_user)
        self.db.commit()
        self.db.refresh(new_user)
        
        default_account = Account(
            user_id=new_user.id,
            name="Efectivo",
            type="efectivo",
            balance=0.0,
            currency="ARS"
        )
        self.db.add(default_account)
        self.db.commit()
        
        access_token = create_access_token(data={"sub": str(new_user.id), "email": new_user.email})
        return new_user, access_token

    def google_login(self, payload: GoogleRequest):
        credential = payload.credential
        if not credential:
            raise HTTPException(status_code=422, detail="Credencial requerida")
            
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={requests.utils.quote(credential)}"
        try:
            response = requests.get(url, timeout=10)
        except Exception:
            raise HTTPException(status_code=502, detail="No se pudo verificar el token con Google. Verificá tu conexión.")
            
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Token de Google inválido o vencido.")
            
        token_data = response.json()
        if "error_description" in token_data or "email" not in token_data:
            raise HTTPException(status_code=401, detail=f"Token de Google inválido: {token_data.get('error_description', 'desconocido')}")

        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
        token_aud = token_data.get("aud", "")
        if GOOGLE_CLIENT_ID and token_aud != GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Token de Google no autorizado para esta aplicación.")

        email_verified = token_data.get("email_verified", "false")
        if str(email_verified).lower() != "true":
            raise HTTPException(status_code=401, detail="El email asociado a esta cuenta de Google no está verificado.")
            
        google_id = token_data.get("sub", "")
        email = token_data.get("email", "")
        name = token_data.get("name", email)
        picture = token_data.get("picture")
        
        parts = name.split()
        avatar = (parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper()
        avatar = avatar[:10]
        
        user = self.db.query(User).filter((User.google_id == google_id) | (User.email == email)).first()
        
        if user:
            user.google_id = google_id
            user.picture = picture
            self.db.commit()
            self.db.refresh(user)
        else:
            user = User(
                name=name,
                email=email,
                google_id=google_id,
                avatar=avatar,
                picture=picture
            )
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
            
            default_account = Account(
                user_id=user.id,
                name="Efectivo",
                type="efectivo",
                balance=0.0,
                currency="ARS"
            )
            self.db.add(default_account)
            self.db.commit()
            
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
        return user, access_token

    def _is_strong_password(self, p: str) -> bool:
        if len(p) < 8: return False
        if not re.search(r"[A-Za-z]", p): return False
        if not re.search(r"[0-9]", p): return False
        return True

def get_auth_service(db: Session):
    return AuthService(db)
