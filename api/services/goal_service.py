from datetime import date
from typing import List, Dict, Any, Optional

from fastapi import HTTPException

from models import Goal, GoalContribution
from ports.repositories.goal_repository_port import IGoalRepository
from ports.repositories.account_repository_port import IAccountRepository
from schemas import GoalCreate, GoalContributionCreate


class GoalService:
    def __init__(self, repository: IGoalRepository, account_repository: Optional[IAccountRepository] = None):
        self.repository = repository
        self.account_repository = account_repository

    def _format_goal(self, goal: Goal) -> Dict[str, Any]:
        raw_contribs = self.repository.get_contributions_by_goal_id(goal.id)
        contribs = []
        for c in raw_contribs:
            if isinstance(c, dict):
                contribs.append(c)
            else:
                contribs.append({
                    "id": c.id,
                    "goal_id": c.goal_id,
                    "amount": c.amount,
                    "date": c.date,
                    "note": c.note,
                    "account_id": getattr(c, "account_id", None),
                    "type": getattr(c, "type", "deposit") or "deposit"
                })

        created_at_str = None
        if hasattr(goal, "created_at") and goal.created_at:
            created_at_str = goal.created_at.isoformat() if hasattr(goal.created_at, "isoformat") else str(goal.created_at)

        return {
            "id": goal.id,
            "name": goal.name,
            "cat": goal.cat,
            "emoji": goal.emoji or "🎯",
            "color": goal.color,
            "target": goal.target,
            "current": goal.current,
            "deadline": goal.deadline,
            "start_date": getattr(goal, "start_date", None) or (created_at_str[:10] if created_at_str else str(date.today())),
            "currency": (getattr(goal, "currency", None) or "ARS").upper(),
            "notes": goal.notes,
            "status": goal.status or "active",
            "created_at": created_at_str,
            "contributions": contribs
        }

    def get_user_goals(self, user_id: int) -> List[Dict[str, Any]]:
        goals = self.repository.get_by_user_id(user_id)
        return [self._format_goal(g) for g in goals]

    def create_goal(self, user_id: int, payload: GoalCreate) -> Dict[str, Any]:
        curr = (payload.currency or "ARS").strip().upper()
        st_date = payload.start_date.strip() if payload.start_date else str(date.today())
        new_goal = Goal(
            user_id=user_id,
            name=payload.name.strip(),
            cat=payload.cat,
            emoji=payload.emoji or "🎯",
            color=payload.color,
            target=payload.target,
            current=payload.current,
            deadline=payload.deadline if payload.deadline else None,
            start_date=st_date,
            currency=curr,
            notes=payload.notes.strip() if payload.notes else None,
            status=payload.status or "active"
        )
        created = self.repository.create(new_goal)
        return self._format_goal(created)

    def update_goal(self, goal_id: int, user_id: int, payload: GoalCreate) -> Dict[str, Any]:
        g = self.repository.get_by_id_and_user_id(goal_id, user_id)
        if not g:
            raise HTTPException(status_code=404, detail="Objetivo no encontrado")
            
        g.name = payload.name.strip()
        g.cat = payload.cat
        g.emoji = payload.emoji or "🎯"
        g.color = payload.color
        g.target = payload.target
        g.current = payload.current
        g.deadline = payload.deadline if payload.deadline else None
        if payload.start_date:
            g.start_date = payload.start_date
        if payload.currency:
            g.currency = payload.currency.strip().upper()
        g.notes = payload.notes.strip() if payload.notes else None
        if payload.status:
            g.status = payload.status
        
        updated = self.repository.update(g)
        return self._format_goal(updated)

    def toggle_status(self, goal_id: int, user_id: int, new_status: Optional[str] = None) -> Dict[str, Any]:
        g = self.repository.get_by_id_and_user_id(goal_id, user_id)
        if not g:
            raise HTTPException(status_code=404, detail="Objetivo no encontrado")
        
        if new_status:
            g.status = new_status
        else:
            g.status = "paused" if g.status == "active" else "active"
            
        updated = self.repository.update(g)
        return self._format_goal(updated)

    def delete_goal(self, goal_id: int, user_id: int) -> None:
        g = self.repository.get_by_id_and_user_id(goal_id, user_id)
        if not g:
            raise HTTPException(status_code=404, detail="Objetivo no encontrado")
            
        self.repository.delete(g)

    def add_contribution(self, goal_id: int, user_id: int, payload: GoalContributionCreate) -> Dict[str, Any]:
        g = self.repository.get_by_id_and_user_id(goal_id, user_id)
        if not g:
            raise HTTPException(status_code=404, detail="Objetivo no encontrado")
            
        contrib_type = (payload.type or "deposit").lower()
        if contrib_type not in ("deposit", "withdraw"):
            contrib_type = "deposit"

        new_contrib = GoalContribution(
            goal_id=goal_id,
            amount=payload.amount,
            date=payload.date,
            note=payload.note.strip() if payload.note else None,
            account_id=payload.account_id,
            type=contrib_type
        )
        self.repository.create_contribution(new_contrib)
        
        if contrib_type == "withdraw":
            g.current = max(0.0, g.current - payload.amount)
        else:
            g.current += payload.amount
        self.repository.update(g)

        if payload.account_id and self.account_repository:
            acc = self.account_repository.get_by_id_and_user_id(payload.account_id, user_id)
            if acc:
                if contrib_type == "withdraw":
                    acc.balance += payload.amount
                else:
                    acc.balance -= payload.amount
                self.account_repository.update(acc)
        
        return self._format_goal(g)

    def delete_contribution(self, goal_id: int, contrib_id: int, user_id: int) -> Dict[str, Any]:
        g = self.repository.get_by_id_and_user_id(goal_id, user_id)
        if not g:
            raise HTTPException(status_code=404, detail="Objetivo no encontrado")
            
        contrib = self.repository.get_contribution_by_id(contrib_id, goal_id)
        if not contrib:
            raise HTTPException(status_code=404, detail="Contribución no encontrada")
            
        c_type = getattr(contrib, "type", "deposit") or "deposit"
        c_amount = contrib.amount
        c_account_id = getattr(contrib, "account_id", None)

        if c_type == "withdraw":
            g.current += c_amount
        else:
            g.current = max(g.current - c_amount, 0.0)

        self.repository.delete_contribution(contrib)
        self.repository.update(g)

        if c_account_id and self.account_repository:
            acc = self.account_repository.get_by_id_and_user_id(c_account_id, user_id)
            if acc:
                if c_type == "withdraw":
                    acc.balance -= c_amount
                else:
                    acc.balance += c_amount
                self.account_repository.update(acc)
        
        return self._format_goal(g)
