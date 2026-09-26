from typing import List, Optional

from fastapi import HTTPException

from models import Budget
from ports.repositories.budget_repository_port import IBudgetRepository
from schemas import BudgetCreate


class BudgetService:
    def __init__(self, repository: IBudgetRepository):
        self.repository = repository

    def get_user_budgets(self, user_id: int) -> List[Budget]:
        return self.repository.get_by_user_id(user_id)

    def create_budget(self, user_id: int, payload: BudgetCreate) -> Budget:
        new_bgt = Budget(
            user_id=user_id,
            cat=payload.cat,
            name=payload.name.strip(),
            icon=payload.icon,
            limit=payload.limit,
            color=payload.color,
            notes=payload.notes.strip() if payload.notes else None
        )
        return self.repository.create(new_bgt)

    def update_budget(self, budget_id: int, user_id: int, payload: BudgetCreate) -> Budget:
        bgt = self.repository.get_by_id_and_user_id(budget_id, user_id)
        if not bgt:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
            
        bgt.cat = payload.cat
        bgt.name = payload.name.strip()
        bgt.icon = payload.icon
        bgt.limit = payload.limit
        bgt.color = payload.color
        bgt.notes = payload.notes.strip() if payload.notes else None
        
        return self.repository.update(bgt)

    def delete_budget(self, budget_id: int, user_id: int) -> None:
        bgt = self.repository.get_by_id_and_user_id(budget_id, user_id)
        if not bgt:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
            
        self.repository.delete(bgt)
