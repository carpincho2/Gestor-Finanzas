import logging
from sqlalchemy import inspect, text
from database import engine, SessionLocal
from models import Account, WalletConnection
from security import token_crypto

logger = logging.getLogger(__name__)


def migrate_schema_columns() -> None:
    """
    Asegura de forma idempotente y con aislamiento transaccional por columna
    que todas las columnas requeridas existan en la base de datos activa
    (compatible con SQLite y PostgreSQL).
    """
    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
    except Exception as exc:
        logger.warning("No se pudo inspeccionar el esquema de DB: %s", exc)
        return

    migrations = {
        "transactions": [
            ("external_id", "VARCHAR(100)"),
        ],
        "users": [
            ("avatar", "VARCHAR(10) DEFAULT 'JP'"),
            ("picture", "VARCHAR(500)"),
        ],
        "budgets": [
            ("currency", "VARCHAR(10) DEFAULT 'ARS'"),
        ],
        "goals": [
            ("currency", "VARCHAR(10) DEFAULT 'ARS'"),
            ("start_date", "VARCHAR(50)"),
        ],
        "goal_contributions": [
            ("account_id", "INTEGER"),
            ("type", "VARCHAR(20) DEFAULT 'deposit'"),
        ],
        "accounts": [
            ("is_archived", "BOOLEAN DEFAULT FALSE"),
            ("is_favorite", "BOOLEAN DEFAULT FALSE"),
            ("color", "VARCHAR(50)"),
            ("icon", "VARCHAR(50)"),
            ("cbu", "VARCHAR(100)"),
            ("alias", "VARCHAR(100)"),
            ("closing_day", "INTEGER"),
            ("due_day", "INTEGER"),
        ],
    }

    for table_name, columns_to_add in migrations.items():
        if table_name not in existing_tables:
            continue
        try:
            existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
        except Exception as exc:
            logger.warning("Error inspeccionando tabla '%s': %s", table_name, exc)
            continue

        for col_name, col_type in columns_to_add:
            if col_name not in existing_cols:
                try:
                    with engine.begin() as conn:
                        conn.execute(
                            text(
                                f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"
                            )
                        )
                    logger.info(
                        "Migración de esquema: añadida columna '%s' a '%s'",
                        col_name,
                        table_name,
                    )
                except Exception as exc:
                    logger.warning(
                        "Omitiendo migración de '%s.%s': %s",
                        table_name,
                        col_name,
                        exc,
                    )


def migrate_plaintext_tokens() -> None:
    """
    Migra y cifra tokens legacy almacenados en texto plano en `accounts.mp_token`
    hacia la tabla dedicada `wallet_connections`.
    """
    db = SessionLocal()
    try:
        migrated = 0
        accs_with_token = (
            db.query(Account)
            .filter(Account.mp_token.isnot(None), Account.mp_token != "")
            .all()
        )
        for acc in accs_with_token:
            token_value = acc.mp_token.strip()
            if not token_value:
                continue

            existing = (
                db.query(WalletConnection)
                .filter(
                    WalletConnection.account_id == acc.id,
                    WalletConnection.user_id == acc.user_id,
                    WalletConnection.provider == "mercadopago",
                )
                .first()
            )
            if existing:
                continue

            encrypted_token = (
                token_crypto.encrypt(token_value)
                if not token_crypto.is_encrypted(token_value)
                else token_value
            )

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
            logger.info(
                "Migración completada: %d token(s) cifrados y migrados a wallet_connections.",
                migrated,
            )
    except Exception as exc:
        db.rollback()
        logger.error("Error en migración de tokens: %s", exc)
    finally:
        db.close()
