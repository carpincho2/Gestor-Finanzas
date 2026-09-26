from typing import List, Optional, Protocol

from models import Budget


class IBudgetRepository(Protocol):
    def get_by_user_id(self, user_id: int) -> List[Budget]:
        ...

    def create(self, budget: Budget) -> Budget:
        ...

    def get_by_id_and_user_id(self, budget_id: int, user_id: int) -> Optional[Budget]:
        ...

    def update(self, budget: Budget) -> Budget:
        ...

    def delete(self, budget: Budget) -> None:
        ...
