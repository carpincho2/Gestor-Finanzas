from typing import Dict, Any, Optional, Protocol

class IProductExtractor(Protocol):
    """
    Puerto de Arquitectura Limpia para extracción de información de productos desde URLs de e-commerce.
    Sigue el Principio de Segregación de Interfaces (ISP) y de Inversión de Dependencias (DIP).
    """

    def can_handle(self, url: str) -> bool:
        """Determina si este extractor tiene la capacidad y reglas para procesar la URL suministrada."""
        ...

    def extract(self, url: str, user_id: Optional[int] = None, user_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Extrae datos clave del producto (título, precio, moneda, dominio, identificador y metadatos).
        Retorna un diccionario estandarizado con la siguiente estructura mínima:
        {
            "ok": bool,
            "item_id": Optional[str],
            "title": str,
            "price": float,
            "currency_id": str,
            "domain": str,
            "has_mp_token": bool,
            "source": str,
            "message": Optional[str]
        }
        """
        ...
