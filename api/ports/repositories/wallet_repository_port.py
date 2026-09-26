from typing import List, Optional, Protocol

from models import WalletConnection, SyncLog


class IWalletRepository(Protocol):
    def get_connection(self, account_id: int, user_id: int, provider: str) -> Optional[WalletConnection]:
        ...
        
    def delete_connections_by_account(self, account_id: int, user_id: int) -> None:
        ...

    def create_connection(self, conn: WalletConnection) -> WalletConnection:
        ...

    def update_connection(self, conn: WalletConnection) -> WalletConnection:
        ...

    def create_sync_log(self, log: SyncLog) -> SyncLog:
        ...

    def get_active_by_provider(self, user_id: int, provider: str) -> Optional[WalletConnection]:
        ...

    def get_any_active_by_provider(self, provider: str) -> Optional[WalletConnection]:
        ...
