from typing import Optional

from sqlalchemy.orm import Session

from models import WalletConnection, SyncLog
from ports.repositories.wallet_repository_port import IWalletRepository


class SQLAlchemyWalletRepository(IWalletRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_connection(self, account_id: int, user_id: int, provider: str) -> Optional[WalletConnection]:
        return self.db.query(WalletConnection).filter(
            WalletConnection.account_id == account_id,
            WalletConnection.user_id == user_id,
            WalletConnection.provider == provider
        ).first()

    def delete_connections_by_account(self, account_id: int, user_id: int) -> None:
        self.db.query(WalletConnection).filter(
            WalletConnection.account_id == account_id,
            WalletConnection.user_id == user_id
        ).delete()
        self.db.commit()

    def create_connection(self, conn: WalletConnection) -> WalletConnection:
        self.db.add(conn)
        self.db.commit()
        self.db.refresh(conn)
        return conn

    def update_connection(self, conn: WalletConnection) -> WalletConnection:
        self.db.commit()
        self.db.refresh(conn)
        return conn

    def create_sync_log(self, log: SyncLog) -> SyncLog:
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def get_active_by_provider(self, user_id: int, provider: str) -> Optional[WalletConnection]:
        return self.db.query(WalletConnection).filter(
            WalletConnection.user_id == user_id,
            WalletConnection.provider == provider,
            WalletConnection.status == "active"
        ).first()

    def get_any_active_by_provider(self, provider: str) -> Optional[WalletConnection]:
        return self.db.query(WalletConnection).filter(
            WalletConnection.provider == provider,
            WalletConnection.status == "active"
        ).first()
