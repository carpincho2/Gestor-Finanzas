"""
Endpoints de precios y comparador de supermercados SEPA.
Arquitectura Hexagonal / PHAME - Principios SOLID.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from infrastructure.dependencies import get_sepa_use_cases
from application.use_cases.sepa_use_cases import SepaUseCases

router = APIRouter(prefix="/api/precios", tags=["precios"])


# ── Schemas de respuesta (endpoint producto individual) ─────────

class PrecioPromoSchema(BaseModel):
    precio_lista: float
    precio_promo_a: Optional[float] = None
    precio_promo_b: Optional[float] = None
    precio_bancario: Optional[float] = None
    precio_minimo: float
    promo_bancaria_desc: Optional[str] = None
    promo_bancaria_tag: Optional[str] = None
    ahorro_pct: float


class SucursalPrecioSchema(BaseModel):
    sucursal_id: int
    comercio: str
    sucursal: Optional[str] = None
    direccion: Optional[str] = None
    localidad: Optional[str] = None
    lat: float
    lng: float
    distancia_km: float
    precios: PrecioPromoSchema
    valor_total: float
    es_precio_mas_bajo: bool = False
    es_mejor_valor: bool = False


class BusquedaPreciosResponse(BaseModel):
    producto: dict
    total_sucursales: int
    precio_mas_bajo: float
    precio_mas_alto: float
    resultados: List[SucursalPrecioSchema]


# ── Schemas de respuesta (endpoint multi-producto) ───────────────

class SucursalResumenSchema(BaseModel):
    sucursal_id: int
    comercio: str
    sucursal: Optional[str] = None
    direccion: Optional[str] = None
    lat: float
    lng: float
    distancia_km: float
    precio_lista: float
    precio_final: float
    ahorro_pct: float
    promo_tag: Optional[str] = None
    es_mejor: bool = False


class ProductoConPreciosSchema(BaseModel):
    ean: str
    nombre: str
    marca: Optional[str] = None
    mejor_precio: float
    precio_promedio: float
    total_sucursales: int
    sucursales: List[SucursalResumenSchema]


class BusquedaMultiProductoResponse(BaseModel):
    query: str
    total_productos: int
    productos: List[ProductoConPreciosSchema]


class StoreChainSchema(BaseModel):
    key: str
    nombre: str


# ── Endpoints ───────────────────────────────────────────────────

@router.get("", response_model=BusquedaPreciosResponse)
def buscar_precios(
    ean: Optional[str] = Query(None, description="EAN/GTIN del producto", min_length=8, max_length=14),
    q: Optional[str] = Query(None, description="Búsqueda por nombre de producto", min_length=2, max_length=100),
    lat: Optional[float] = Query(None, description="Latitud del usuario"),
    lng: Optional[float] = Query(None, description="Longitud del usuario"),
    radio: float = Query(10.0, description="Radio de búsqueda en km", ge=0.5, le=50.0),
    sepa_use_cases: SepaUseCases = Depends(get_sepa_use_cases),
):
    """
    Busca precios de un producto específico en sucursales dentro del radio indicado.
    Calcula costo de viaje, promociones bancarias y mejor valor total.
    """
    if not ean and not q:
        raise HTTPException(
            status_code=400,
            detail="Debés proporcionar un EAN o un nombre de producto para buscar.",
        )

    comparacion = sepa_use_cases.compare_single_product(
        ean=ean,
        query=q,
        lat=lat,
        lng=lng,
        radio_km=radio,
    )

    if comparacion is None:
        identificador = ean if ean else q
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró información de precios para '{identificador}'.",
        )

    resultados_schema = [
        SucursalPrecioSchema(
            sucursal_id=r.sucursal_id,
            comercio=r.comercio,
            sucursal=r.sucursal,
            direccion=r.direccion,
            localidad=r.localidad,
            lat=r.lat,
            lng=r.lng,
            distancia_km=r.distancia_km,
            precios=PrecioPromoSchema(
                precio_lista=r.precio_lista,
                precio_promo_a=r.precio_promo_a,
                precio_promo_b=r.precio_promo_b,
                precio_bancario=r.precio_bancario,
                precio_minimo=r.precio_minimo,
                promo_bancaria_desc=r.promo_bancaria_desc,
                promo_bancaria_tag=r.promo_bancaria_tag,
                ahorro_pct=r.ahorro_pct,
            ),
            valor_total=r.valor_total,
            es_precio_mas_bajo=r.es_precio_mas_bajo,
            es_mejor_valor=r.es_mejor_valor,
        )
        for r in comparacion.resultados
    ]

    return BusquedaPreciosResponse(
        producto=comparacion.producto,
        total_sucursales=comparacion.total_sucursales,
        precio_mas_bajo=comparacion.precio_mas_bajo,
        precio_mas_alto=comparacion.precio_mas_alto,
        resultados=resultados_schema,
    )


@router.get("/buscar", response_model=BusquedaMultiProductoResponse)
def buscar_productos(
    q: str = Query(..., description="Búsqueda por nombre de producto", min_length=2, max_length=100),
    lat: Optional[float] = Query(None, description="Latitud del usuario"),
    lng: Optional[float] = Query(None, description="Longitud del usuario"),
    radio: float = Query(10.0, description="Radio de búsqueda en km", ge=0.5, le=50.0),
    cadena: Optional[str] = Query(None, description="Filtrar por cadena de supermercado"),
    orden: Optional[str] = Query(None, description="Ordenar por 'precio', 'distancia' o 'ahorro'"),
    sepa_use_cases: SepaUseCases = Depends(get_sepa_use_cases),
):
    """
    Busca múltiples productos que coincidan con la query y devuelve
    los mejores precios de cada uno en supermercados cercanos.
    Permite filtrar por cadena y ordenar por conveniencia.
    """
    productos_dominio = sepa_use_cases.search_products(
        query=q,
        lat=lat,
        lng=lng,
        radio_km=radio,
        cadena_filter=cadena,
        sort_by=orden,
    )

    return BusquedaMultiProductoResponse(
        query=q,
        total_productos=len(productos_dominio),
        productos=[
            ProductoConPreciosSchema(
                ean=p.ean,
                nombre=p.nombre,
                marca=p.marca,
                mejor_precio=p.mejor_precio,
                precio_promedio=p.precio_promedio,
                total_sucursales=p.total_sucursales,
                sucursales=[
                    SucursalResumenSchema(
                        sucursal_id=s.sucursal_id,
                        comercio=s.comercio,
                        sucursal=s.sucursal,
                        direccion=s.direccion,
                        lat=s.lat,
                        lng=s.lng,
                        distancia_km=s.distancia_km,
                        precio_lista=s.precio_lista,
                        precio_final=s.precio_final,
                        ahorro_pct=s.ahorro_pct,
                        promo_tag=s.promo_tag,
                        es_mejor=s.es_mejor,
                    )
                    for s in p.sucursales
                ],
            )
            for p in productos_dominio
        ],
    )


@router.get("/comercios", response_model=List[StoreChainSchema])
def obtener_cadenas_comercios(
    sepa_use_cases: SepaUseCases = Depends(get_sepa_use_cases),
):
    """Obtiene el listado de cadenas de supermercados registradas."""
    cadenas = sepa_use_cases.get_available_chains()
    return [StoreChainSchema(key=c.key, nombre=c.nombre) for c in cadenas]


@router.get("/sugerencias", response_model=List[str])
def obtener_sugerencias(
    sepa_use_cases: SepaUseCases = Depends(get_sepa_use_cases),
):
    """Obtiene términos populares y esenciales para búsquedas rápidas."""
    return sepa_use_cases.get_popular_suggestions()


@router.post("/ingesta/trigger", tags=["sistema"])
def trigger_ingesta():
    """Dispara la ingesta manualmente (útil para primer uso o debug)."""
    from services.sepa.ingestion import trigger_ingesta_background
    trigger_ingesta_background()
    return {"status": "ingesta iniciada en background"}


@router.post("/seed", tags=["sistema"])
@router.get("/seed", tags=["sistema"])
def seed_database():
    """Fuerza la ejecución del seed idempotente de la DB."""
    from seed_dummy import seed_db
    seed_db()
    return {"status": "seed ejecutado exitosamente"}
