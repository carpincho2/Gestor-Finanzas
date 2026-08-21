from sqlalchemy import Column, Integer, String, DateTime, Float, func, ForeignKey, Index, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base

class TicketItem(Base):
    __tablename__ = "ticket_items"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=True)
    store_name = Column(String(255), nullable=True)
    item_name = Column(String(255), nullable=False)
    qty = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=True)
    total_price = Column(Float, nullable=True)
    date = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    google_id = Column(String(255), index=True, nullable=True)
    avatar = Column(String(10), default="JP")
    picture = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    bank = Column(String(255), nullable=True)
    balance = Column(Float, default=0.0)
    currency = Column(String(10), default="ARS")
    limit = Column(Float, default=0.0)
    notes = Column(String(500), nullable=True)
    mp_token = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False)
    account_id = Column(Integer, index=True, nullable=True)
    type = Column(String(50), nullable=False)
    desc = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    cat = Column(String(100), nullable=False)
    date = Column(String(50), nullable=False)
    transfer_id = Column(Integer, nullable=True)
    # ID externo del proveedor (ej: 'mp-1234567890') para deduplicar importaciones
    external_id = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())

class Budget(Base):
    __tablename__ = "budgets"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False)
    cat = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    icon = Column(String(50), default="📦")
    limit = Column(Float, nullable=False)
    color = Column(String(50), nullable=False)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    cat = Column(String(100), nullable=False)
    emoji = Column(String(50), default="🎯")
    color = Column(String(50), nullable=False)
    target = Column(Float, nullable=False)
    current = Column(Float, default=0.0)
    deadline = Column(String(50), nullable=True)
    notes = Column(String(500), nullable=True)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, server_default=func.now())

class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    goal_id = Column(Integer, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(String(50), nullable=False)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class WalletConnection(Base):
    __tablename__ = "wallet_connections"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False)
    account_id = Column(Integer, index=True, nullable=False)
    provider = Column(String(50), nullable=False)
    provider_user_id = Column(String(255), nullable=True)
    access_token_encrypted = Column(String(1000), nullable=True)
    refresh_token_encrypted = Column(String(1000), nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="active")
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(String(20), nullable=True)
    last_sync_error = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class SyncLog(Base):
    __tablename__ = "sync_log"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    wallet_connection_id = Column(Integer, index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=False)
    provider = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    transactions_imported = Column(Integer, default=0)
    transactions_skipped = Column(Integer, default=0)
    error_message = Column(String(500), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

# ── Modelos SEPA ─────────────────────────────────────────────────────────

class Comercio(Base):
    __tablename__ = "comercios"

    id          = Column(Integer, primary_key=True)
    sepa_id     = Column(String(20), unique=True, nullable=False, index=True)
    nombre      = Column(String(100), nullable=False)
    nombre_key  = Column(String(100), nullable=False, index=True)
    cuit        = Column(String(13))

    sucursales  = relationship("Sucursal", back_populates="comercio")


class Sucursal(Base):
    __tablename__ = "sucursales"

    id              = Column(Integer, primary_key=True)
    sepa_id         = Column(String(20), unique=True, nullable=False, index=True)
    comercio_id     = Column(Integer, ForeignKey("comercios.id"), nullable=False)
    nombre          = Column(String(150))
    direccion       = Column(String(200))
    localidad       = Column(String(100))
    provincia       = Column(String(100))
    codigo_postal   = Column(String(10))
    lat             = Column(Float, nullable=False)
    lng             = Column(Float, nullable=False)
    activa          = Column(Boolean, default=True)

    comercio        = relationship("Comercio", back_populates="sucursales")
    precios         = relationship("Precio", back_populates="sucursal")

    __table_args__ = (
        Index("ix_sucursal_lat_lng", "lat", "lng"),
    )


class Producto(Base):
    __tablename__ = "productos"

    id                  = Column(Integer, primary_key=True)
    ean                 = Column(String(20), unique=True, nullable=False, index=True)
    nombre              = Column(String(250), nullable=False)
    nombre_normalizado  = Column(String(250), nullable=False, index=True)
    marca               = Column(String(100))
    categoria           = Column(String(100))
    presentacion        = Column(String(50))

    precios             = relationship("Precio", back_populates="producto")


class Precio(Base):
    __tablename__ = "precios"

    id              = Column(Integer, primary_key=True)
    sucursal_id     = Column(Integer, ForeignKey("sucursales.id"), nullable=False)
    producto_id     = Column(Integer, ForeignKey("productos.id"), nullable=False)
    precio_unitario = Column(Float, nullable=False)
    precio_promo_a  = Column(Float)
    precio_promo_b  = Column(Float)
    fecha_vigencia  = Column(DateTime, nullable=False)
    actualizado_en  = Column(DateTime, default=func.now(), onupdate=func.now())

    sucursal        = relationship("Sucursal", back_populates="precios")
    producto        = relationship("Producto", back_populates="precios")

    __table_args__ = (
        Index("ix_precio_sucursal_ean", "sucursal_id", "producto_id"),
        Index("ix_precio_fecha", "fecha_vigencia"),
    )


class IngestaLog(Base):
    __tablename__ = "ingesta_logs"

    id              = Column(Integer, primary_key=True)
    iniciada_en     = Column(DateTime, default=func.now())
    finalizada_en   = Column(DateTime)
    estado          = Column(String(20))
    fuente          = Column(String(50))
    filas_procesadas= Column(Integer, default=0)
    filas_cargadas  = Column(Integer, default=0)
    filas_error     = Column(Integer, default=0)
    detalle         = Column(Text)
