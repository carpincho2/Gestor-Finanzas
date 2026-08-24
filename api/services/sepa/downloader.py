"""
Descarga de archivos del SEPA desde datos.produccion.gob.ar.

El portal publica un ZIP que contiene varios CSV:
  - comercios.csv
  - sucursales.csv
  - sepa_producto.csv
  - sepa_precio.csv       ← el más grande (~12M registros diarios)

El ZIP se sobreescribe diariamente. Descargamos y guardamos en /tmp
con el timestamp en el nombre para conservar historial local si se necesita.

Implementa:
  - Reintentos con backoff exponencial (tenacity)
  - Circuit breaker simple: si falla 3 veces seguidas, levanta excepción
    para que el scheduler no siga reintentando indefinidamente
  - Fallback a la API de Precios Abiertos si el portal oficial no responde
"""

import io
import zipfile
import tempfile
from datetime import datetime
from pathlib import Path
import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import structlog

from .config import get_settings

log = structlog.get_logger()
settings = get_settings()

# URL del dataset SEPA en el portal de datos abiertos
# Nota: el UUID del recurso puede cambiar. Verificar en:
# https://datos.produccion.gob.ar/dataset/sepa-precios
SEPA_DATASET_URL = (
    "https://datos.produccion.gob.ar/dataset/sepa-precios/resource/"
    "{uuid}/download/sepa_precios.zip"
)

# Nombres de archivos dentro del ZIP (pueden variar entre versiones del SEPA)
CSV_COMERCIOS   = "comercios.csv"
CSV_SUCURSALES  = "sucursales.csv"
CSV_PRODUCTOS   = "sepa_producto.csv"
CSV_PRECIOS     = "sepa_precio.csv"

TIMEOUT_SEGUNDOS = 120   # el ZIP puede pesar varios cientos de MB


class SEPANoDisponible(Exception):
    """El portal oficial del SEPA no respondió correctamente."""


@retry(
    retry=retry_if_exception_type(requests.RequestException),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=10, max=120),
    reraise=True,
)
def descargar_zip_sepa(resource_uuid: str | None = None) -> zipfile.ZipFile:
    """
    Descarga el ZIP del SEPA y lo retorna como objeto ZipFile en memoria.
    
    Si resource_uuid es None, usa el del .env.
    Reintenta hasta 3 veces con backoff exponencial.
    
    Raises:
        SEPANoDisponible: si agota los reintentos.
    """
    uuid = resource_uuid or settings.sepa_resource_uuid
    if not uuid:
        raise ValueError(
            "SEPA_RESOURCE_UUID no configurado. "
            "Verificar en datos.produccion.gob.ar/dataset/sepa-precios"
        )

    url = SEPA_DATASET_URL.format(uuid=uuid)
    log.info("sepa.descarga.inicio", url=url)

    try:
        response = requests.get(url, timeout=TIMEOUT_SEGUNDOS, stream=True)
        response.raise_for_status()
    except requests.RequestException as e:
        log.warning("sepa.descarga.error", error=str(e))
        raise

    contenido = response.content
    log.info("sepa.descarga.ok", bytes=len(contenido))

    return zipfile.ZipFile(io.BytesIO(contenido))


def listar_archivos_zip(zf: zipfile.ZipFile) -> list[str]:
    """Retorna los nombres de archivos dentro del ZIP."""
    return zf.namelist()


def leer_csv_desde_zip(zf: zipfile.ZipFile, nombre: str) -> io.TextIOWrapper:
    """
    Abre un CSV del ZIP como stream de texto.
    
    El SEPA usa encoding latin-1 (ISO-8859-1) en la mayoría de sus archivos.
    Si el archivo no existe con el nombre exacto, busca coincidencia parcial.
    """
    archivos = zf.namelist()

    # Coincidencia exacta
    if nombre in archivos:
        return io.TextIOWrapper(zf.open(nombre), encoding="latin-1", errors="replace")

    # Coincidencia parcial (el nombre puede tener prefijos de fecha)
    candidatos = [a for a in archivos if nombre in a]
    if not candidatos:
        raise KeyError(
            f"No se encontró '{nombre}' en el ZIP. "
            f"Archivos disponibles: {archivos}"
        )

    archivo = candidatos[0]
    log.warning("sepa.csv.nombre_alternativo", esperado=nombre, encontrado=archivo)
    return io.TextIOWrapper(zf.open(archivo), encoding="latin-1", errors="replace")


def guardar_zip_local(zf_bytes: bytes, directorio: str = "/tmp") -> Path:
    """
    Guarda el ZIP en disco con timestamp para tener historial local.
    Útil para re-procesar sin volver a descargar.
    """
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    path = Path(directorio) / f"sepa_{ts}.zip"
    path.write_bytes(zf_bytes)
    log.info("sepa.zip.guardado", path=str(path))
    return path


# ------------------------------------------------------------------
# Fallback: API de Precios Abiertos
# ------------------------------------------------------------------

def buscar_precios_api_fallback(ean: str, lat: float, lng: float, radio_km: int = 10) -> list[dict]:
    """
    Consulta la API comunitaria de Precios Abiertos cuando el SEPA no está disponible.
    
    Retorna lista de dicts con: sucursal, precio, lat, lng, distancia.
    
    NOTA: esta API no tiene SLA oficial y puede tener datos desactualizados.
    Usarla solo como fallback temporal.
    """
    url = f"{settings.precios_abiertos_url}/precios"
    params = {
        "ean": ean,
        "lat": lat,
        "lng": lng,
        "radio": radio_km * 1000,  # la API espera metros
    }

    try:
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()
        return r.json().get("precios", [])
    except requests.RequestException as e:
        log.error("precios_abiertos.error", error=str(e))
        return []
