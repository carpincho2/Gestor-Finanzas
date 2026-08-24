import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    sepa_resource_uuid: str = os.getenv("SEPA_RESOURCE_UUID", "0d4b9714-38ff-4f40-8bda-69a4c5148009")
    precios_abiertos_url: str = os.getenv("PRECIOS_ABIERTOS_URL", "https://api.preciosabiertos.com")
    costo_km: float = 150.0  # Costo estimado de desplazamiento por km
    ingesta_hora_utc: int = 4  # 4 AM UTC = 1 AM Arg

def get_settings() -> Settings:
    return Settings()
