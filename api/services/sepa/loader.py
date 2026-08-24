"""
Carga de datos limpios a la base de datos.

Estrategia de upsert:
  - Comercios y Sucursales: upsert por sepa_id (cambian poco)
  - Productos: upsert por EAN (catálogo estable)
  - Precios: REEMPLAZO COMPLETO diario (los archivos SEPA son snapshots, no diffs)
    → DELETE en lote por fecha_vigencia anterior + INSERT del día

Para tablas grandes (precios: ~12M filas) se usa inserción en chunks
para no sobrecargar la memoria ni hacer un commit gigante.
"""

from datetime import datetime, date
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
import structlog

from models import Comercio, Sucursal, Producto, Precio, IngestaLog
from .cleaner import normalizar_nombre

log = structlog.get_logger()

CHUNK_SIZE = 5_000   # filas por commit en la carga de precios


def upsert_comercios(df: pd.DataFrame, db: Session) -> dict[str, int]:
    """
    Inserta o actualiza comercios. Retorna mapa sepa_id → id interno.
    """
    mapa = {}
    for _, row in df.iterrows():
        sepa_id = str(row.get("id_comercio", "")).strip()
        nombre  = str(row.get("razon_social", row.get("nombre", ""))).strip()
        if not sepa_id:
            continue

        comercio = db.query(Comercio).filter_by(sepa_id=sepa_id).first()
        if comercio is None:
            comercio = Comercio(
                sepa_id=sepa_id,
                nombre=nombre,
                nombre_key=normalizar_nombre(nombre),
                cuit=str(row.get("cuit", "")).strip() or None,
            )
            db.add(comercio)
            db.flush()
        else:
            comercio.nombre = nombre
            comercio.nombre_key = normalizar_nombre(nombre)

        mapa[sepa_id] = comercio.id

    db.commit()
    log.info("loader.comercios.ok", total=len(mapa))
    return mapa


def upsert_sucursales(
    df: pd.DataFrame,
    db: Session,
    mapa_comercios: dict[str, int],
) -> dict[str, int]:
    """
    Inserta o actualiza sucursales. Retorna mapa sepa_id_sucursal → id interno.
    """
    mapa = {}
    sin_comercio = 0

    for _, row in df.iterrows():
        sepa_id_s = str(row.get("id_sucursal", "")).strip()
        sepa_id_c = str(row.get("id_comercio", "")).strip()
        comercio_id = mapa_comercios.get(sepa_id_c)

        if not sepa_id_s or comercio_id is None:
            sin_comercio += 1
            continue

        sucursal = db.query(Sucursal).filter_by(sepa_id=sepa_id_s).first()
        if sucursal is None:
            sucursal = Sucursal(
                sepa_id=sepa_id_s,
                comercio_id=comercio_id,
                nombre=str(row.get("nombre", "")).strip() or None,
                direccion=str(row.get("direccion", "")).strip() or None,
                localidad=str(row.get("localidad", "")).strip() or None,
                provincia=str(row.get("provincia", "")).strip() or None,
                codigo_postal=str(row.get("codigo_postal", "")).strip() or None,
                lat=float(row["latitud"]),
                lng=float(row["longitud"]),
            )
            db.add(sucursal)
            db.flush()
        else:
            sucursal.lat = float(row["latitud"])
            sucursal.lng = float(row["longitud"])
            sucursal.direccion = str(row.get("direccion", "")).strip() or sucursal.direccion

        mapa[sepa_id_s] = sucursal.id

    db.commit()
    if sin_comercio:
        log.warning("loader.sucursales.sin_comercio", cantidad=sin_comercio)
    log.info("loader.sucursales.ok", total=len(mapa))
    return mapa


def upsert_productos(df: pd.DataFrame, db: Session) -> dict[str, int]:
    """
    Inserta o actualiza productos por EAN. Retorna mapa EAN → id interno.
    """
    mapa = {}
    for _, row in df.iterrows():
        ean = str(row["ean"]).strip()
        nombre = str(row["nombre"]).strip()

        producto = db.query(Producto).filter_by(ean=ean).first()
        if producto is None:
            producto = Producto(
                ean=ean,
                nombre=nombre,
                nombre_normalizado=str(row.get("nombre_normalizado", normalizar_nombre(nombre))),
                marca=str(row.get("marca", "")).strip() or None,
                categoria=str(row.get("categoria", "")).strip() or None,
            )
            db.add(producto)
            db.flush()
        else:
            # Actualizar nombre si cambió (los comercios a veces corrigen descripciones)
            producto.nombre = nombre
            producto.nombre_normalizado = normalizar_nombre(nombre)

        mapa[ean] = producto.id

    db.commit()
    log.info("loader.productos.ok", total=len(mapa))
    return mapa


def cargar_precios(
    df: pd.DataFrame,
    db: Session,
    mapa_sucursales: dict[str, int],
    mapa_productos: dict[str, int],
    fecha_vigencia: date | None = None,
) -> tuple[int, int]:
    """
    Reemplaza los precios del día:
      1. Borra precios con la misma fecha_vigencia (re-run seguro)
      2. Inserta en chunks de CHUNK_SIZE

    Returns:
        (filas_cargadas, filas_error)
    """
    if fecha_vigencia is None:
        fecha_vigencia = date.today()

    # Borrar precios previos del mismo día (idempotencia)
    borrados = db.query(Precio).filter(
        Precio.fecha_vigencia >= datetime.combine(fecha_vigencia, datetime.min.time()),
        Precio.fecha_vigencia <  datetime.combine(fecha_vigencia, datetime.max.time()),
    ).delete(synchronize_session=False)
    db.commit()
    if borrados:
        log.info("loader.precios.borrados_previos", fecha=str(fecha_vigencia), filas=borrados)

    cargadas = 0
    errores = 0
    batch = []

    for _, row in df.iterrows():
        sepa_id_s = str(row.get("id_sucursal", "")).strip()
        ean       = str(row.get("ean", "")).strip()

        sucursal_id = mapa_sucursales.get(sepa_id_s)
        producto_id = mapa_productos.get(ean)

        if sucursal_id is None or producto_id is None:
            errores += 1
            continue

        batch.append({
            "sucursal_id":   sucursal_id,
            "producto_id":   producto_id,
            "precio_unitario": float(row["precio"]),
            "precio_promo_a": float(row["precio_promo_a"]) if pd.notna(row.get("precio_promo_a")) else None,
            "precio_promo_b": float(row["precio_promo_b"]) if pd.notna(row.get("precio_promo_b")) else None,
            "fecha_vigencia": datetime.combine(fecha_vigencia, datetime.min.time()),
            "actualizado_en": datetime.utcnow(),
        })

        if len(batch) >= CHUNK_SIZE:
            db.bulk_insert_mappings(Precio, batch)
            db.commit()
            cargadas += len(batch)
            log.debug("loader.precios.chunk", cargadas=cargadas)
            batch = []

    # Último batch
    if batch:
        db.bulk_insert_mappings(Precio, batch)
        db.commit()
        cargadas += len(batch)

    log.info("loader.precios.ok", cargadas=cargadas, errores=errores, fecha=str(fecha_vigencia))
    return cargadas, errores


def registrar_log_ingesta(
    db: Session,
    estado: str,
    fuente: str,
    filas_procesadas: int = 0,
    filas_cargadas: int = 0,
    filas_error: int = 0,
    detalle: str | None = None,
    iniciada_en: datetime | None = None,
) -> IngestaLog:
    entrada = IngestaLog(
        iniciada_en=iniciada_en or datetime.utcnow(),
        finalizada_en=datetime.utcnow(),
        estado=estado,
        fuente=fuente,
        filas_procesadas=filas_procesadas,
        filas_cargadas=filas_cargadas,
        filas_error=filas_error,
        detalle=detalle,
    )
    db.add(entrada)
    db.commit()
    return entrada
