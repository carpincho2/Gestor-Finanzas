from typing import List, Optional

from sqlalchemy.orm import Session

from models import Goal, GoalContribution
from ports.repositories.goal_repository_port import IGoalRepository


class SQLAlchemyGoalRepository(IGoalRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_user_id(self, user_id: int) -> List[Goal]:
        return self.db.query(Goal).filter(Goal.user_id == user_id).all()

    def get_by_id_and_user_id(self, goal_id: int, user_id: int) -> Optional[Goal]:
        return self.db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()

    def create(self, goal: Goal) -> Goal:
        self.db.add(goal)
        self.db.commit()
        self.db.refresh(goal)
        return goal

    def update(self, goal: Goal) -> Goal:
        self.db.commit()
        self.db.refresh(goal)
        return goal

    def delete(self, goal: Goal) -> None:
        self.db.query(GoalContribution).filter(GoalContribution.goal_id == goal.id).delete()
        self.db.delete(goal)
        self.db.commit()

    def get_contributions_by_goal_id(self, goal_id: int) -> List[GoalContribution]:
        return self.db.query(GoalContribution).filter(GoalContribution.goal_id == goal_id).order_by(GoalContribution.date.asc()).all()

    def create_contribution(self, contribution: GoalContribution) -> GoalContribution:
        self.db.add(contribution)
        self.db.commit()
        self.db.refresh(contribution)
        return contribution

    def get_contribution_by_id(self, contrib_id: int, goal_id: int) -> Optional[GoalContribution]:
        return self.db.query(GoalContribution).filter(GoalContribution.id == contrib_id, GoalContribution.goal_id == goal_id).first()

    def delete_contribution(self, contribution: GoalContribution) -> None:
        self.db.delete(contribution)
        self.db.commit()
