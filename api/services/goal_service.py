from typing import List, Dict, Any

from fastapi import HTTPException

from models import Goal, GoalContribution
from ports.repositories.goal_repository_port import IGoalRepository
from schemas import GoalCreate, GoalContributionCreate


class GoalService:
    def __init__(self, repository: IGoalRepository):
        self.repository = repository

    def _format_goal(self, goal: Goal) -> Dict[str, Any]:
        contribs = self.repository.get_contributions_by_goal_id(goal.id)
        return {
            "id": goal.id,
            "name": goal.name,
            "cat": goal.cat,
            "emoji": goal.emoji,
            "color": goal.color,
            "target": goal.target,
            "current": goal.current,
            "deadline": goal.deadline,
            "notes": goal.notes,
            "status": goal.status,
            "contributions": contribs
        }

    def get_user_goals(self, user_id: int) -> List[Dict[str, Any]]:
        goals = self.repository.get_by_user_id(user_id)
        return [self._format_goal(g) for g in goals]

    def create_goal(self, user_id: int, payload: GoalCreate) -> Dict[str, Any]:
        new_goal = Goal(
            user_id=user_id,
            name=payload.name.strip(),
            cat=payload.cat,
            emoji=payload.emoji,
            color=payload.color,
            target=payload.target,
            current=payload.current,
            deadline=payload.deadline if payload.deadline else None,
            notes=payload.notes.strip() if payload.notes else None,
            status=payload.status
        )
        created = self.repository.create(new_goal)
        return self._format_goal(created)

    def update_goal(self, goal_id: int, user_id: int, payload: GoalCreate) -> Dict[str, Any]:
        g = self.repository.get_by_id_and_user_id(goal_id, user_id)
        if not g:
            raise HTTPException(status_code=404, detail="Objetivo no encontrado")
            
        g.name = payload.name.strip()
        g.cat = payload.cat
        g.emoji = payload.emoji
        g.color = payload.color
        g.target = payload.target
        g.current = payload.current
        g.deadline = payload.deadline if payload.deadline else None
        g.notes = payload.notes.strip() if payload.notes else None
        g.status = payload.status
        
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
            
        new_contrib = GoalContribution(
            goal_id=goal_id,
            amount=payload.amount,
            date=payload.date,
            note=payload.note.strip() if payload.note else None
        )
        self.repository.create_contribution(new_contrib)
        
        g.current += payload.amount
        self.repository.update(g)
        
        return self._format_goal(g)

    def delete_contribution(self, goal_id: int, contrib_id: int, user_id: int) -> Dict[str, Any]:
        g = self.repository.get_by_id_and_user_id(goal_id, user_id)
        if not g:
            raise HTTPException(status_code=404, detail="Objetivo no encontrado")
            
        contrib = self.repository.get_contribution_by_id(contrib_id, goal_id)
        if not contrib:
            raise HTTPException(status_code=404, detail="Contribución no encontrada")
            
        g.current = max(g.current - contrib.amount, 0.0)
        self.repository.delete_contribution(contrib)
        self.repository.update(g)
        
        return self._format_goal(g)
