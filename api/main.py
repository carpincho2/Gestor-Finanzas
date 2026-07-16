import os
from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from database import engine, Base, DATABASE_URL, load_env
from routers import auth, accounts, transactions, budgets, goals, wallets, ai, shopping, ocr

# Load .env variables (if any are missing)
load_env()

# Auto-create tables (SQLite and PostgreSQL)
Base.metadata.create_all(bind=engine)

# Run migrations for legacy tokens
from models import Account, WalletConnection
from security import token_crypto
from database import SessionLocal

def migrate_plaintext_tokens():
    db = SessionLocal()
    try:
        migrated = 0
        accs_with_token = db.query(Account).filter(Account.mp_token.isnot(None), Account.mp_token != "").all()
        for acc in accs_with_token:
            token_value = acc.mp_token.strip()
            if not token_value:
                continue

            existing = db.query(WalletConnection).filter(
                WalletConnection.account_id == acc.id,
                WalletConnection.user_id == acc.user_id,
                WalletConnection.provider == "mercadopago"
            ).first()

            if existing:
                continue

            encrypted_token = token_crypto.encrypt(token_value) if not token_crypto.is_encrypted(token_value) else token_value

            new_conn = WalletConnection(
                user_id=acc.user_id,
                account_id=acc.id,
                provider="mercadopago",
                access_token_encrypted=encrypted_token,
                status="active",
            )
            db.add(new_conn)
            migrated += 1

        if migrated > 0:
            db.commit()
            print(f"INFO: Migración completada: {migrated} token(s) cifrados y migrados a wallet_connections.")
    except Exception as e:
        db.rollback()
        print(f"ERROR: Error en migración de tokens: {e}")
    finally:
        db.close()

migrate_plaintext_tokens()

app = FastAPI(title="Flujo Finance Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
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
    max_age=86400 * 30,
    same_site="lax",
    https_only=IS_PRODUCTION
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Include routers
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(goals.router)
app.include_router(wallets.router)
app.include_router(ai.router)
app.include_router(shopping.router)
app.include_router(ocr.router)

# Serve static files
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app.mount("/js", StaticFiles(directory=os.path.join(BASE_DIR, "js")), name="js")
app.mount("/css", StaticFiles(directory=os.path.join(BASE_DIR, "css")), name="css")
app.mount("/html", StaticFiles(directory=os.path.join(BASE_DIR, "html")), name="html")
app.mount("/mds", StaticFiles(directory=os.path.join(BASE_DIR, "mds")), name="mds")
app.mount("/data", StaticFiles(directory=os.path.join(BASE_DIR, "data")), name="data")
app.mount("/tests", StaticFiles(directory=os.path.join(BASE_DIR, "tests")), name="tests")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(content="", media_type="image/x-icon")

@app.get("/", response_class=FileResponse)
async def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/index.html", response_class=FileResponse)
async def serve_index_html():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/main.html", response_class=FileResponse)
async def serve_main():
    return FileResponse(os.path.join(BASE_DIR, "main.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
