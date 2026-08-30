"""
Endpoints de precios.

GET /precios
  Retorna precios de un producto en sucursales cercanas,
  incluyendo promociones vigentes y valor total (precio + viaje).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from services.sepa.comparador import (
    comparar_precios, buscar_producto_por_texto, ResultadoSucursal,
    buscar_productos_con_precios,
)

router = APIRouter(prefix="/precios", tags=["precios"])


# ── Schemas de respuesta (endpoint original) ─────────────────────

class PrecioPromoSchema(BaseModel):
    precio_lista: float
    precio_promo_a: float | None = None
    precio_promo_b: float | None = None
    precio_bancario: float | None = None
    precio_minimo: float
    promo_bancaria_desc: str | None = None
    promo_bancaria_tag: str | None = None
    ahorro_pct: float


class SucursalPrecioSchema(BaseModel):
    sucursal_id: int
    comercio: str
    sucursal: str | None
    direccion: str | None
    localidad: str | None
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
    resultados: list[SucursalPrecioSchema]


# ── Schemas de respuesta (endpoint multi-producto) ───────────────

class SucursalResumenSchema(BaseModel):
    sucursal_id: int
    comercio: str
    sucursal: str | None = None
    direccion: str | None = None
    lat: float
    lng: float
    distancia_km: float
    precio_lista: float
    precio_final: float
    ahorro_pct: float
    promo_tag: str | None = None
    es_mejor: bool = False


class ProductoConPreciosSchema(BaseModel):
    ean: str
    nombre: str
    marca: str | None = None
    mejor_precio: float
    precio_promedio: float
    total_sucursales: int
    sucursales: list[SucursalResumenSchema]


class BusquedaMultiProductoResponse(BaseModel):
    query: str
    total_productos: int
    productos: list[ProductoConPreciosSchema]


# ── Endpoint original (retro-compatible) ─────────────────────────

@router.get("", response_model=BusquedaPreciosResponse)
def buscar_precios(
    ean: str | None = Query(None, description="EAN/GTIN del producto", min_length=8, max_length=14),
    q: str | None = Query(None, description="Búsqueda por nombre de producto", min_length=2, max_length=100),
    lat: float = Query(..., description="Latitud del usuario", ge=-55.0, le=-21.0),
    lng: float = Query(..., description="Longitud del usuario", ge=-74.0, le=-53.0),
    radio: float = Query(10.0, description="Radio de búsqueda en km", ge=0.5, le=50.0),
    db: Session = Depends(get_db),
):
    """
    Busca precios de un producto en sucursales dentro del radio indicado.
    
    Los resultados incluyen:
    - Precio de lista
    - Precio con promoción general (promo A del SEPA)
    - Precio con promoción segmentada (promo B del SEPA)
    - Precio con descuento bancario vigente hoy
    - Precio mínimo (el mejor de los anteriores)
    - Valor total = precio_mínimo + costo estimado de viaje
    
    Ordenados por mejor valor total.
    """
    if not ean and not q:
        raise HTTPException(status_code=400, detail="Debés proporcionar un EAN o un nombre de producto para buscar.")

    # Si se recibió un texto (nombre), buscar el producto por fuzzy search primero
    if not ean and q:
        productos = buscar_producto_por_texto(query=q, db=db, limite=1)
        if not productos:
            raise HTTPException(status_code=404, detail=f"No se encontró ningún producto que coincida con '{q}'.")
        ean = productos[0].ean

    busqueda = comparar_precios(ean=ean, lat=lat, lng=lng, radio_km=radio, db=db)

    if busqueda is None:
        raise HTTPException(status_code=404, detail=f"Producto con EAN {ean} no encontrado.")

    mejor_valor_id = busqueda.mejor_valor.sucursal_id if busqueda.mejor_valor else None
    precio_min_global = busqueda.precio_mas_bajo

    items = []
    for r in busqueda.resultados:
        items.append(SucursalPrecioSchema(
            sucursal_id=r.sucursal_id,
            comercio=r.comercio_nombre,
            sucursal=r.sucursal_nombre,
            direccion=r.direccion,
            localidad=r.localidad,
            lat=r.lat,
            lng=r.lng,
            distancia_km=r.distancia_km,
            precios=PrecioPromoSchema(
                precio_lista=r.precios.precio_lista,
                precio_promo_a=r.precios.precio_promo_a,
                precio_promo_b=r.precios.precio_promo_b,
                precio_bancario=r.precios.precio_bancario,
                precio_minimo=r.precios.precio_minimo,
                promo_bancaria_desc=r.precios.promo_bancaria.descripcion if r.precios.promo_bancaria else None,
                promo_bancaria_tag=r.precios.promo_bancaria.tag_corto if r.precios.promo_bancaria else None,
                ahorro_pct=r.precios.ahorro_pct,
            ),
            valor_total=r.valor_total,
            es_precio_mas_bajo=(r.precios.precio_minimo == precio_min_global),
            es_mejor_valor=(r.sucursal_id == mejor_valor_id),
        ))

    return BusquedaPreciosResponse(
        producto=busqueda.producto,
        total_sucursales=len(items),
        precio_mas_bajo=busqueda.precio_mas_bajo,
        precio_mas_alto=busqueda.precio_mas_alto,
        resultados=items,
    )


# ── Endpoint multi-producto ──────────────────────────────────────

@router.get("/buscar", response_model=BusquedaMultiProductoResponse)
def buscar_productos(
    q: str = Query(..., description="Búsqueda por nombre de producto", min_length=2, max_length=100),
    lat: float = Query(..., description="Latitud del usuario", ge=-55.0, le=-21.0),
    lng: float = Query(..., description="Longitud del usuario", ge=-74.0, le=-53.0),
    radio: float = Query(10.0, description="Radio de búsqueda en km", ge=0.5, le=50.0),
    db: Session = Depends(get_db),
):
    """
    Busca múltiples productos que coincidan con la query y devuelve
    los mejores precios de cada uno en supermercados cercanos.
    
    Ideal para búsquedas generales como "leche", "coca", "aceite".
    Cada producto muestra hasta 5 sucursales ordenadas por precio.
    """
    resultado = buscar_productos_con_precios(
        query=q, lat=lat, lng=lng, radio_km=radio, db=db,
    )

    return BusquedaMultiProductoResponse(
        query=resultado.query,
        total_productos=resultado.total_productos,
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
            for p in resultado.productos
        ],
    )


@router.post("/ingesta/trigger", tags=["sistema"])
def trigger_ingesta():
    """Dispara la ingesta manualmente (útil para primer uso o debug)."""
    from services.sepa.ingestion import trigger_ingesta_background
    trigger_ingesta_background()
    return {"status": "ingesta iniciada en background"}

