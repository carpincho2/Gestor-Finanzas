from typing import List, Optional, Protocol, Tuple

from models import Transaction


class ITransactionRepository(Protocol):
    def get_by_user_id(self, user_id: int) -> List[Transaction]:
        ...

    def get_by_user_id_asc(self, user_id: int) -> List[Transaction]:
        ...

    def get_by_id_and_user_id(self, tx_id: int, user_id: int) -> Optional[Transaction]:
        ...

    def create(self, transaction: Transaction) -> Transaction:
        ...

    def create_bulk(self, transactions: List[Transaction]) -> List[Transaction]:
        ...

    def update(self, transaction: Transaction) -> Transaction:
        ...

    def delete(self, transaction: Transaction) -> None:
        ...

    def delete_all_by_user_id(self, user_id: int) -> None:
        ...

    def delete_by_account_id(self, account_id: int, user_id: int) -> None:
        ...
