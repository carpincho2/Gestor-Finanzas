from typing import List, Optional, Protocol

from models import Account


class IAccountRepository(Protocol):
    def get_by_user_id(self, user_id: int) -> List[Account]:
        ...

    def get_by_id_and_user_id(self, account_id: int, user_id: int) -> Optional[Account]:
        ...

    def create(self, account: Account) -> Account:
        ...

    def update(self, account: Account) -> Account:
        ...

    def delete(self, account: Account) -> None:
        ...

    def reset_balances(self, user_id: int) -> None:
        ...
