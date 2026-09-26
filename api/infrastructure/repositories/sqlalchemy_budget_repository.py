from typing import List, Optional

from sqlalchemy.orm import Session

from models import Budget
from ports.repositories.budget_repository_port import IBudgetRepository


class SQLAlchemyBudgetRepository(IBudgetRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_user_id(self, user_id: int) -> List[Budget]:
        return self.db.query(Budget).filter(Budget.user_id == user_id).all()

    def create(self, budget: Budget) -> Budget:
        self.db.add(budget)
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def get_by_id_and_user_id(self, budget_id: int, user_id: int) -> Optional[Budget]:
        return self.db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == user_id).first()

    def update(self, budget: Budget) -> Budget:
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def delete(self, budget: Budget) -> None:
        self.db.delete(budget)
        self.db.commit()
