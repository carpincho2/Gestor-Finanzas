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
    Búsqueda de productos por nombre (SQL ILIKE + RapidFuzz).
    
    1. Si es EAN, busca directo.
    2. Búsqueda por subcadena exacta (SQL ILIKE).
    3. Búsqueda por palabras clave individuales (SQL ILIKE).
    4. Búsqueda Fuzzy con rapidfuzz como respaldo.
    """
    query_limpio = query.strip().lower()
    if not query_limpio:
        return []

    # 1. EAN
    if query_limpio.isdigit() and 8 <= len(query_limpio) <= 14:
        producto = db.query(Producto).filter_by(ean=query_limpio).first()
        return [producto] if producto else []

    # 2. SQL ILIKE directo sobre nombre o nombre_normalizado
    sql_matches = (
        db.query(Producto)
        .filter(
            (Producto.nombre.ilike(f"%{query_limpio}%")) | 
            (Producto.nombre_normalizado.ilike(f"%{query_limpio}%"))
        )
        .limit(limite)
        .all()
    )
    if sql_matches:
        return sql_matches

    # 3. SQL ILIKE por palabras individuales (todas las palabras deben coincidir)
    palabras = [p for p in query_limpio.split() if len(p) > 1]
    if len(palabras) > 1:
        from sqlalchemy import and_
        condiciones = [
            (Producto.nombre.ilike(f"%{p}%")) | (Producto.nombre_normalizado.ilike(f"%{p}%"))
            for p in palabras
        ]
        sql_multi = db.query(Producto).filter(and_(*condiciones)).limit(limite).all()
        if sql_multi:
            return sql_multi
        
        # O coincidencia con al menos una palabra clave relevante (ej: "leche")
        for p in palabras:
            sql_single = db.query(Producto).filter(
                (Producto.nombre.ilike(f"%{p}%")) | (Producto.nombre_normalizado.ilike(f"%{p}%"))
            ).limit(limite).all()
            if sql_single:
                return sql_single

    # 4. Fuzzy search (si rapidfuzz está instalado)
    if process is not None and fuzz is not None:
        productos = db.query(Producto.id, Producto.nombre_normalizado).all()
        if productos:
            nombres = [p.nombre_normalizado or "" for p in productos]
            matches = process.extract(
                query_limpio,
                nombres,
                scorer=fuzz.WRatio,
                limit=limite,
                score_cutoff=umbral_similitud,
            )
            if matches:
                ids = [productos[match[2]].id for match in matches]
                return db.query(Producto).filter(Producto.id.in_(ids)).all()

    return []


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
    """
    if fecha is None:
        fecha = date.today()

    producto = db.query(Producto).filter_by(ean=ean).first()
    if producto is None:
        log.warning("comparador.producto_no_encontrado", ean=ean)
        return None

    # 1. Bounding box para pre-filtrar sucursales en SQL dentro del radio
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

    # Respaldo: si no hay sucursales en el radio estrecho (ej. test desde otra ciudad), buscar todas las sucursales del producto
    if not sucursales_candidatas:
        sucursales_candidatas = (
            db.query(Sucursal, Comercio, Precio)
            .join(Comercio, Sucursal.comercio_id == Comercio.id)
            .join(Precio, Precio.sucursal_id == Sucursal.id)
            .filter(
                Precio.producto_id == producto.id,
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


# ── Búsqueda Multi-Producto ─────────────────────────────────────────

@dataclass
class SucursalPrecioResumen:
    """Precio de un producto en una sucursal específica."""
    sucursal_id: int
    comercio: str
    sucursal: str | None
    direccion: str | None
    lat: float
    lng: float
    distancia_km: float
    precio_lista: float
    precio_final: float  # precio_minimo con promos aplicadas
    ahorro_pct: float
    promo_tag: str | None
    es_mejor: bool = False


@dataclass
class ProductoConPrecios:
    """Un producto con sus precios en distintas sucursales."""
    ean: str
    nombre: str
    marca: str | None
    mejor_precio: float
    precio_promedio: float
    total_sucursales: int
    sucursales: list[SucursalPrecioResumen]


@dataclass
class ResultadoMultiProducto:
    """Respuesta del endpoint de búsqueda multi-producto."""
    query: str
    total_productos: int
    productos: list[ProductoConPrecios]


def buscar_productos_con_precios(
    query: str,
    lat: float,
    lng: float,
    radio_km: float = 10.0,
    db: Session = None,
    limite_productos: int = 15,
    limite_sucursales: int = 5,
    fecha: date | None = None,
) -> ResultadoMultiProducto:
    """
    Búsqueda multi-producto: encuentra todos los productos que coincidan
    con la query y devuelve, para cada uno, sus mejores precios en
    sucursales cercanas.

    Args:
        query: Nombre del producto o EAN.
        lat, lng: Ubicación del usuario.
        radio_km: Radio de búsqueda en km.
        db: Sesión de base de datos.
        limite_productos: Máximo de productos a devolver.
        limite_sucursales: Máximo de sucursales por producto.
        fecha: Fecha para evaluar promos. Default: hoy.
    """
    if fecha is None:
        fecha = date.today()

    # 1. Buscar productos que matcheen la query
    productos = buscar_producto_por_texto(query=query, db=db, limite=limite_productos)

    if not productos:
        return ResultadoMultiProducto(query=query, total_productos=0, productos=[])

    # 2. Pre-calcular bounding box (una sola vez para todos los productos)
    bb = bounding_box(lat, lng, radio_km)

    resultados = []

    for producto in productos:
        # 3. Buscar sucursales cercanas que tengan este producto
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

        # Fallback: si no hay en el radio, buscar todas
        if not sucursales_candidatas:
            sucursales_candidatas = (
                db.query(Sucursal, Comercio, Precio)
                .join(Comercio, Sucursal.comercio_id == Comercio.id)
                .join(Precio, Precio.sucursal_id == Sucursal.id)
                .filter(
                    Precio.producto_id == producto.id,
                    Sucursal.activa == True,
                )
                .limit(limite_sucursales)
                .all()
            )

        if not sucursales_candidatas:
            continue

        # 4. Calcular precio final para cada sucursal
        sucursales_con_precio = []
        for sucursal, comercio, precio in sucursales_candidatas:
            dist = haversine(lat, lng, sucursal.lat, sucursal.lng)

            precios = calcular_precio_final(
                precio_lista=precio.precio_unitario,
                precio_promo_a=precio.precio_promo_a,
                precio_promo_b=precio.precio_promo_b,
                cadena=comercio.nombre_key,
                fecha=fecha,
            )

            sucursales_con_precio.append(SucursalPrecioResumen(
                sucursal_id=sucursal.id,
                comercio=comercio.nombre,
                sucursal=sucursal.nombre,
                direccion=sucursal.direccion,
                lat=sucursal.lat,
                lng=sucursal.lng,
                distancia_km=round(dist, 2),
                precio_lista=precios.precio_lista,
                precio_final=precios.precio_minimo,
                ahorro_pct=precios.ahorro_pct,
                promo_tag=precios.promo_bancaria.tag_corto if precios.promo_bancaria else None,
            ))

        # 5. Ordenar por precio_final y limitar
        sucursales_con_precio.sort(key=lambda s: s.precio_final)
        sucursales_con_precio = sucursales_con_precio[:limite_sucursales]

        # Marcar la mejor
        if sucursales_con_precio:
            sucursales_con_precio[0].es_mejor = True

        precios_finales = [s.precio_final for s in sucursales_con_precio]
        mejor = min(precios_finales) if precios_finales else 0
        promedio = round(sum(precios_finales) / len(precios_finales), 2) if precios_finales else 0

        resultados.append(ProductoConPrecios(
            ean=producto.ean,
            nombre=producto.nombre,
            marca=producto.marca,
            mejor_precio=mejor,
            precio_promedio=promedio,
            total_sucursales=len(sucursales_con_precio),
            sucursales=sucursales_con_precio,
        ))

    # 6. Ordenar productos por mejor_precio (más barato primero)
    resultados.sort(key=lambda p: p.mejor_precio if p.mejor_precio > 0 else float('inf'))

    return ResultadoMultiProducto(
        query=query,
        total_productos=len(resultados),
        productos=resultados,
    )

