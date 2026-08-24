import pandas as pd
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
import structlog
import threading

from database import SessionLocal
from .config import get_settings
from .downloader import descargar_zip_sepa, leer_csv_desde_zip
from .cleaner import limpiar_precios, limpiar_sucursales, limpiar_productos
from .loader import (
    upsert_comercios, upsert_sucursales, upsert_productos,
    cargar_precios, registrar_log_ingesta
)

log = structlog.get_logger()
settings = get_settings()
scheduler = BackgroundScheduler()

def ejecutar_ingesta():
    """
    Pipeline completo de ingesta del SEPA:
      1. Descargar ZIP
      2. Limpiar CSVs
      3. Upsert comercios, sucursales, productos
      4. Reemplazar precios
      5. Loguear
    """
    inicio = datetime.utcnow()
    log.info("ingesta.inicio")
    db = SessionLocal()

    try:
        zf = descargar_zip_sepa()
    except Exception as e:
        log.error("ingesta.descarga.fallo", error=str(e))
        registrar_log_ingesta(db, estado="error", fuente="sepa_oficial",
                              detalle=str(e), iniciada_en=inicio)
        db.close()
        return

    try:
        # Leer y limpiar cada CSV
        df_com = pd.read_csv(leer_csv_desde_zip(zf, "comercios.csv"), dtype=str)
        df_suc = pd.read_csv(leer_csv_desde_zip(zf, "sucursales.csv"), dtype=str)
        df_prod_raw = pd.read_csv(leer_csv_desde_zip(zf, "sepa_producto.csv"), dtype=str)
        df_prec_raw = pd.read_csv(leer_csv_desde_zip(zf, "sepa_precio.csv"), dtype=str,
                                  chunksize=100_000)

        df_suc_clean  = limpiar_sucursales(df_suc)
        df_prod_clean = limpiar_productos(df_prod_raw)

        # Upserts de catálogo
        mapa_comercios  = upsert_comercios(df_com, db)
        mapa_sucursales = upsert_sucursales(df_suc_clean, db, mapa_comercios)
        mapa_productos  = upsert_productos(df_prod_clean, db)

        # Precios
        total_procesadas = 0
        total_cargadas   = 0
        total_errores    = 0

        for chunk in df_prec_raw:
            chunk_clean = limpiar_precios(chunk)
            cargadas, errores = cargar_precios(
                chunk_clean, db, mapa_sucursales, mapa_productos
            )
            total_procesadas += len(chunk)
            total_cargadas   += cargadas
            total_errores    += errores

        registrar_log_ingesta(
            db, estado="ok", fuente="sepa_oficial",
            filas_procesadas=total_procesadas,
            filas_cargadas=total_cargadas,
            filas_error=total_errores,
            iniciada_en=inicio,
        )
        log.info("ingesta.ok", cargadas=total_cargadas, errores=total_errores)

    except Exception as e:
        log.error("ingesta.error", error=str(e))
        registrar_log_ingesta(db, estado="error", fuente="sepa_oficial",
                              detalle=str(e), iniciada_en=inicio)
    finally:
        db.close()

def iniciar_scheduler():
    scheduler.add_job(
        ejecutar_ingesta,
        trigger="cron",
        hour=settings.ingesta_hora_utc,
        minute=0,
        id="ingesta_sepa",
        replace_existing=True,
    )
    scheduler.start()
    log.info("scheduler.iniciado", hora_utc=settings.ingesta_hora_utc)

def detener_scheduler():
    scheduler.shutdown(wait=False)

def trigger_ingesta_background():
    threading.Thread(target=ejecutar_ingesta, daemon=True).start()
