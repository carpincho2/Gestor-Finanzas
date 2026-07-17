import os
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, Request

# Configuración JWT
JWT_SECRET = os.getenv("ENCRYPTION_KEY", "super-secret-default-key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60 * 24 * 30 # 30 días

class TokenEncryptionService:
    """Servicio de cifrado simétrico para tokens OAuth usando Fernet."""

    def __init__(self):
        key = os.getenv("ENCRYPTION_KEY", "").strip()
        if not key:
            # Auto-generar clave y advertir (solo para desarrollo local)
            key = Fernet.generate_key().decode()
            os.environ["ENCRYPTION_KEY"] = key
            print("WARNING: ENCRYPTION_KEY auto-generada para desarrollo local.")
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
            # Si el token no se puede descifrar, retornamos el valor tal cual
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

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def get_current_user_id(request: Request):
    auth_header = request.headers.get("Authorization")
    jwt_error = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("sub")
            if user_id is not None:
                return int(user_id)
        except Exception as e:
            jwt_error = f"JWT Decode error: {type(e).__name__} - {str(e)}"
            print(jwt_error)
            pass # Si falla el token, caer a la cookie o lanzar error luego
            
    # 2. Intentar obtener el usuario desde la Cookie de Sesión (Web)
    user_id = request.session.get("user_id")
    
    if not user_id:
        error_detail = "No autorizado"
        if jwt_error:
            error_detail += f" ({jwt_error})"
        raise HTTPException(status_code=401, detail=error_detail)
    return user_id

# Dummy hash generado con bcrypt para igualar tiempos (aprox 100ms)
DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"dummy_password_for_timing_attack_prevention", bcrypt.gensalt())
