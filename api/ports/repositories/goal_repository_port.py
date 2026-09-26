from typing import List, Optional, Protocol

from models import Goal, GoalContribution


class IGoalRepository(Protocol):
    def get_by_user_id(self, user_id: int) -> List[Goal]:
        ...

    def get_by_id_and_user_id(self, goal_id: int, user_id: int) -> Optional[Goal]:
        ...

    def create(self, goal: Goal) -> Goal:
        ...

    def update(self, goal: Goal) -> Goal:
        ...

    def delete(self, goal: Goal) -> None:
        ...

    def get_contributions_by_goal_id(self, goal_id: int) -> List[GoalContribution]:
        ...

    def create_contribution(self, contribution: GoalContribution) -> GoalContribution:
        ...

    def get_contribution_by_id(self, contrib_id: int, goal_id: int) -> Optional[GoalContribution]:
        ...

    def delete_contribution(self, contribution: GoalContribution) -> None:
        ...
