from dataclasses import dataclass
from typing import Optional, List

@dataclass
class StorePriceEntity:
    sucursal_id: int
    comercio: str
    sucursal: Optional[str]
    direccion: Optional[str]
    lat: float
    lng: float
    distancia_km: float
    precio_lista: float
    precio_final: float
    ahorro_pct: float
    promo_tag: Optional[str] = None
    es_mejor: bool = False

@dataclass
class ProductWithPricesEntity:
    ean: str
    nombre: str
    marca: Optional[str]
    mejor_precio: float
    precio_promedio: float
    total_sucursales: int
    sucursales: List[StorePriceEntity]
