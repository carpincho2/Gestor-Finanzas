"""
Servicio de comparación de precios.

Orquesta:
  1. Búsqueda de producto por texto o EAN (fuzzy search con rapidfuzz)
  2. Filtrado geográfico con bounding box + Haversine
  3. Cálculo de precio final con motor de promociones
  4. Ranking por valor total = precio_final + costo_desplazamiento
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import date

try:
    from rapidfuzz import process, fuzz
except ImportError:
    # Fallback if rapidfuzz is not installed
    process = None
    fuzz = None

from sqlalchemy.orm import Session
import structlog

from .geo import bounding_box, haversine
from .promociones import calcular_precio_final, PrecioFinal
from .config import get_settings
from models import Producto, Sucursal, Precio, Comercio

log = structlog.get_logger()
settings = get_settings()


@dataclass
class ResultadoSucursal:
    sucursal_id: int
    comercio_nombre: str
    sucursal_nombre: str | None
    direccion: str | None
    localidad: str | None
    lat: float
    lng: float
    distancia_km: float
    precios: PrecioFinal
    # Puntuación compuesta: precio_minimo + costo_desplazamiento
    valor_total: float

    @property
    def ahorro_vs_mas_caro(self) -> float:
        return 0.0  # se calcula al comparar el set completo


@dataclass
class ResultadoBusqueda:
    producto: dict
    resultados: list[ResultadoSucursal]
    # Referencia para calcular ahorro relativo
    precio_mas_alto: float
    precio_mas_bajo: float
    mejor_valor: ResultadoSucursal | None   # menor valor_total


def buscar_producto_por_texto(
    query: str,
    db: Session,
    limite: int = 10,
    umbral_similitud: int = 60,
) -> list[Producto]:
    """
    Búsqueda fuzzy de productos por nombre.
    
    Usa rapidfuzz para comparar el query contra nombre_normalizado.
    Para queries exactos de EAN, hace búsqueda directa.
    
    Args:
        query: texto libre o EAN numérico
        umbral_similitud: 0-100. 60 es permisivo (ok para typos),
                          80 es estricto (solo coincidencias claras)
    """
    query_limpio = query.strip().lower()

    # Si parece un EAN (solo dígitos, longitud 8-14)
    if query_limpio.isdigit() and 8 <= len(query_limpio) <= 14:
        producto = db.query(Producto).filter_by(ean=query_limpio).first()
        return [producto] if producto else []

    # Fuzzy search: cargar todos los nombres normalizados
    # NOTA: en producción con 70k+ productos, pre-cargar en Redis/memoria
    # y actualizar al final de cada ingesta es más eficiente que consultar la DB.
    productos = db.query(Producto.id, Producto.nombre_normalizado).all()

    if not productos:
        return []

    nombres = [p.nombre_normalizado for p in productos]
    matches = process.extract(
        query_limpio,
        nombres,
        scorer=fuzz.WRatio,
        limit=limite,
        score_cutoff=umbral_similitud,
    )

    ids = [productos[match[2]].id for match in matches]
    return db.query(Producto).filter(Producto.id.in_(ids)).all()


def comparar_precios(
    ean: str,
    lat: float,
    lng: float,
    radio_km: float = 10.0,
    db: Session = None,
    fecha: date | None = None,
) -> ResultadoBusqueda | None:
    """
    Consulta principal del sistema.
    
    Dado un EAN y una ubicación, retorna la lista de sucursales cercanas
    con precios ordenados por mejor valor total (precio + costo de viaje).
    
    Algoritmo:
      1. Bounding box sobre lat/lng (filtro en SQL)
      2. Haversine en Python para distancia exacta
      3. Motor de promociones para precio final
      4. Ranking por valor_total = precio_minimo + distancia_km * COSTO_KM
    """
    if fecha is None:
        fecha = date.today()

    producto = db.query(Producto).filter_by(ean=ean).first()
    if producto is None:
        log.warning("comparador.producto_no_encontrado", ean=ean)
        return None

    # 1. Bounding box para pre-filtrar sucursales en SQL
    bb = bounding_box(lat, lng, radio_km)

    sucursales_candidatas = (
        db.query(Sucursal, Comercio, Precio)
        .join(Comercio, Sucursal.comercio_id == Comercio.id)
        .join(Precio, Precio.sucursal_id == Sucursal.id)
        .filter(
            Precio.producto_id == producto.id,
            Sucursal.lat.between(bb.lat_min, bb.lat_max),
            Sucursal.lng.between(bb.lng_min, bb.lng_max),
            Sucursal.activa == True,
        )
        .all()
    )

    if not sucursales_candidatas:
        log.info("comparador.sin_resultados", ean=ean, radio_km=radio_km)
        return ResultadoBusqueda(
            producto={"ean": producto.ean, "nombre": producto.nombre},
            resultados=[],
            precio_mas_alto=0,
            precio_mas_bajo=0,
            mejor_valor=None,
        )

    resultados = []
    for sucursal, comercio, precio in sucursales_candidatas:
        # 2. Distancia exacta con Haversine
        dist = haversine(lat, lng, sucursal.lat, sucursal.lng)
        if dist > radio_km:
            continue   # descarte del bounding box que quedó fuera del círculo

        # 3. Precio final con promociones
        precios = calcular_precio_final(
            precio_lista=precio.precio_unitario,
            precio_promo_a=precio.precio_promo_a,
            precio_promo_b=precio.precio_promo_b,
            cadena=comercio.nombre_key,
            fecha=fecha,
        )

        # 4. Valor total: precio + costo de viaje (ida)
        costo_viaje = round(dist * settings.costo_km, 2)
        valor_total  = round(precios.precio_minimo + costo_viaje, 2)

        resultados.append(ResultadoSucursal(
            sucursal_id=sucursal.id,
            comercio_nombre=comercio.nombre,
            sucursal_nombre=sucursal.nombre,
            direccion=sucursal.direccion,
            localidad=sucursal.localidad,
            lat=sucursal.lat,
            lng=sucursal.lng,
            distancia_km=round(dist, 2),
            precios=precios,
            valor_total=valor_total,
        ))

    # Ordenar por valor total (mejor conveniencia primero)
    resultados.sort(key=lambda r: r.valor_total)

    precios_minimos = [r.precios.precio_minimo for r in resultados]

    return ResultadoBusqueda(
        producto={"ean": producto.ean, "nombre": producto.nombre, "marca": producto.marca},
        resultados=resultados,
        precio_mas_alto=max(precios_minimos) if precios_minimos else 0,
        precio_mas_bajo=min(precios_minimos) if precios_minimos else 0,
        mejor_valor=resultados[0] if resultados else None,
    )
