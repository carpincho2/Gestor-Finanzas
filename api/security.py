import os
import bcrypt
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, Request

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

def get_current_user_id(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")
    return user_id

# Dummy hash generado con bcrypt para igualar tiempos (aprox 100ms)
DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"dummy_password_for_timing_attack_prevention", bcrypt.gensalt())
