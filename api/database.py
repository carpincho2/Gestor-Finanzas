import logging
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger("flujo.database")


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("=", 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = parts[1].strip()
                    if (val.startswith('"') and val.endswith('"')) or (
                        val.startswith("'") and val.endswith("'")
                    ):
                        val = val[1:-1]
                    os.environ[key] = val


load_env()

SQLITE_FALLBACK_URL = "sqlite:///./database.db"
DATABASE_URL = os.getenv("DATABASE_URL", SQLITE_FALLBACK_URL).strip() or SQLITE_FALLBACK_URL

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)


def _create_verified_engine(db_url: str):
    """
    Crea el motor SQLAlchemy y verifica la conectividad real.
    Si el servidor remoto (PostgreSQL) no responde o expiró, aplica
    failover automático a SQLite local para garantizar disponibilidad 24/7.
    """
    global DATABASE_URL
    if db_url.startswith("sqlite"):
        return create_engine(db_url, connect_args={"check_same_thread": False})

    candidate_engine = create_engine(
        db_url, pool_pre_ping=True, connect_args={"connect_timeout": 5}
    )
    try:
        with candidate_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return candidate_engine
    except Exception as exc:
        logger.warning(
            "PostgreSQL no disponible (%s). Activando fallback automático a SQLite local.",
            exc,
        )
        candidate_engine.dispose()
        DATABASE_URL = SQLITE_FALLBACK_URL
        return create_engine(
            SQLITE_FALLBACK_URL, connect_args={"check_same_thread": False}
        )


engine = _create_verified_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
