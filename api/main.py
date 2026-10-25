import asyncio
import logging
import mimetypes
import os
from contextlib import asynccontextmanager

# Registrar tipo MIME válido para que el navegador ejecute módulos .ts nativamente
mimetypes.add_type("application/javascript", ".ts")

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from database import Base, DATABASE_URL, engine, load_env
from infrastructure.migrations import migrate_plaintext_tokens, migrate_schema_columns
from routers import (
    accounts,
    ai,
    auth,
    budgets,
    goals,
    ocr,
    sepa,
    shopping,
    transactions,
    wallets,
)

# Configurar logging estructurado
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("flujo.main")

# Cargar variables de entorno (.env)
load_env()


async def render_keep_alive() -> None:
    """
    Tarea asíncrona de mantenimiento (Keep-Alive) para evitar la hibernación
    del contenedor en entornos cloud gratuitos (como Render).
    """
    render_url = os.getenv("RENDER_EXTERNAL_URL")
    if not render_url:
        return

    ping_url = f"{render_url.rstrip('/')}/health"
    async with httpx.AsyncClient(timeout=10.0) as client:
        while True:
            await asyncio.sleep(14 * 60)  # Cada 14 minutos
            try:
                await client.get(ping_url)
                logger.debug("Keep-alive ping exitoso a %s", ping_url)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("Fallo en keep-alive ping: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Crear tablas, aplicar migraciones y seed inicial de forma aislada
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Error en Base.metadata.create_all: %s", exc)

    try:
        migrate_schema_columns()
    except Exception as exc:
        logger.warning("Error en migrate_schema_columns: %s", exc)

    try:
        migrate_plaintext_tokens()
    except Exception as exc:
        logger.warning("Error en migrate_plaintext_tokens: %s", exc)

    try:
        from seed_dummy import seed_db
        seed_db()
    except Exception as exc:
        logger.warning("No se pudo completar seed_db en inicio: %s", exc)

    # Iniciar scheduler SEPA
    try:
        from services.sepa.ingestion import detener_scheduler, iniciar_scheduler
        iniciar_scheduler()
    except Exception as exc:
        logger.warning("No se pudo iniciar scheduler SEPA: %s", exc)

    keep_alive_task = asyncio.create_task(render_keep_alive())
    yield

    # Shutdown limpio
    keep_alive_task.cancel()
    try:
        await keep_alive_task
    except asyncio.CancelledError:
        pass

    try:
        from services.sepa.ingestion import detener_scheduler
        detener_scheduler()
    except Exception:
        pass


app = FastAPI(
    title="Flujo Finance Manager API",
    version="2.3.0",
    lifespan=lifespan,
)

# Configuración CORS flexible (Localhost + Dominio de Producción)
ALLOWED_ORIGIN_REGEX = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"https?://(localhost|127\.0\.0\.1|.*\.onrender\.com)(:\d+)?",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.getenv("SECRET_KEY", "flujo-secret-key-change-this-in-prod-12345")
IS_PRODUCTION = bool(os.getenv("RENDER")) or DATABASE_URL.startswith("postgresql")

app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="flujo_session",
    max_age=86400 * 1,  # 24 horas para Web
    same_site="lax",
    https_only=IS_PRODUCTION,
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Excepción no controlada en %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Error interno del servidor",
            "detail": str(exc),
        },
    )


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response


# Registro de Routers
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(goals.router)
app.include_router(wallets.router)
app.include_router(ai.router)
app.include_router(shopping.router)
app.include_router(ocr.router)
app.include_router(sepa.router)


@app.get("/health", tags=["system"])
async def health_check():
    """Endpoint de monitoreo y disponibilidad del servicio."""
    return JSONResponse({"status": "ok", "service": "flujo-api", "version": "2.3.0"})


# Archivos estáticos públicos (sin exponer /tests ni /mds internos)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app.mount("/js", StaticFiles(directory=os.path.join(BASE_DIR, "js")), name="js")
app.mount("/css", StaticFiles(directory=os.path.join(BASE_DIR, "css")), name="css")
app.mount("/html", StaticFiles(directory=os.path.join(BASE_DIR, "html")), name="html")
app.mount("/data", StaticFiles(directory=os.path.join(BASE_DIR, "data")), name="data")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = os.path.join(BASE_DIR, "html", "imgs", "descarga.png")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/png")
    return Response(content="", media_type="image/x-icon")


@app.get("/", response_class=FileResponse, include_in_schema=False)
async def serve_index():
    return FileResponse(
        os.path.join(BASE_DIR, "index.html"),
        headers={"Cache-Control": "no-cache, must-revalidate"},
    )


@app.get("/index.html", response_class=FileResponse, include_in_schema=False)
async def serve_index_html():
    return FileResponse(
        os.path.join(BASE_DIR, "index.html"),
        headers={"Cache-Control": "no-cache, must-revalidate"},
    )


@app.get("/main.html", response_class=FileResponse, include_in_schema=False)
async def serve_main():
    return FileResponse(
        os.path.join(BASE_DIR, "main.html"),
        headers={"Cache-Control": "no-cache, must-revalidate"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
