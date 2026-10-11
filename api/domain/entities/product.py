from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


@dataclass
class StorePriceEntity:
    """Representa el precio resumido de un producto en una sucursal para listas multi-producto."""
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
    """Entidad de dominio para un producto con su comparativa de precios en distintas sucursales."""
    ean: str
    nombre: str
    marca: Optional[str]
    mejor_precio: float
    precio_promedio: float
    total_sucursales: int
    sucursales: List[StorePriceEntity] = field(default_factory=list)


@dataclass
class SingleStorePriceDetailEntity:
    """Detalle completo del precio y promociones en una sucursal para un producto individual."""
    sucursal_id: int
    comercio: str
    sucursal: Optional[str]
    direccion: Optional[str]
    localidad: Optional[str]
    lat: float
    lng: float
    distancia_km: float
    precio_lista: float
    precio_promo_a: Optional[float]
    precio_promo_b: Optional[float]
    precio_bancario: Optional[float]
    precio_minimo: float
    promo_bancaria_desc: Optional[str]
    promo_bancaria_tag: Optional[str]
    ahorro_pct: float
    valor_total: float
    es_precio_mas_bajo: bool = False
    es_mejor_valor: bool = False


@dataclass
class SingleProductComparisonEntity:
    """Comparativa detallada de un producto individual entre múltiples sucursales."""
    producto: Dict[str, Any]
    total_sucursales: int
    precio_mas_bajo: float
    precio_mas_alto: float
    resultados: List[SingleStorePriceDetailEntity] = field(default_factory=list)


@dataclass
class StoreChainEntity:
    """Representa una cadena de supermercado disponible en el sistema."""
    key: str
    nombre: str
