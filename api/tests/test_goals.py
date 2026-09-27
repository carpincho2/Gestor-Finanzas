import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from services.goal_service import GoalService
from models import Goal, GoalContribution
from schemas import GoalCreate, GoalContributionCreate

def test_get_user_goals():
    repo = MagicMock()
    service = GoalService(repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation", cat="travel", emoji="plane", color="#fff", target=1000.0, current=0.0, status="active")
    repo.get_by_user_id.return_value = [mock_goal]
    repo.get_contributions_by_goal_id.return_value = []

    goals = service.get_user_goals(1)
    
    assert len(goals) == 1
    assert goals[0]["name"] == "Vacation"
    assert goals[0]["contributions"] == []
    repo.get_by_user_id.assert_called_once_with(1)

def test_create_goal():
    repo = MagicMock()
    service = GoalService(repo)
    
    payload = GoalCreate(name="Vacation", cat="travel", emoji="plane", color="#fff", target=1000.0, current=0.0, status="active")
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation", cat="travel", emoji="plane", color="#fff", target=1000.0, current=0.0, status="active")
    repo.create.return_value = mock_goal
    repo.get_contributions_by_goal_id.return_value = []

    goal = service.create_goal(1, payload)
    
    assert goal["id"] == 1
    assert goal["name"] == "Vacation"
    repo.create.assert_called_once()

def test_update_goal_success():
    repo = MagicMock()
    service = GoalService(repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Old Vacation", cat="travel", emoji="plane", color="#fff", target=1000.0, current=0.0, status="active")
    repo.get_by_id_and_user_id.return_value = mock_goal
    repo.update.return_value = mock_goal
    repo.get_contributions_by_goal_id.return_value = []
    
    payload = GoalCreate(name="New Vacation", cat="travel", emoji="plane", color="#fff", target=2000.0, current=0.0, status="active")
    
    goal = service.update_goal(1, 1, payload)
    
    assert goal["name"] == "New Vacation"
    assert goal["target"] == 2000.0
    repo.get_by_id_and_user_id.assert_called_once_with(1, 1)
    repo.update.assert_called_once_with(mock_goal)

def test_delete_goal_success():
    repo = MagicMock()
    service = GoalService(repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation")
    repo.get_by_id_and_user_id.return_value = mock_goal
    
    service.delete_goal(1, 1)
    
    repo.delete.assert_called_once_with(mock_goal)

def test_add_contribution_success():
    repo = MagicMock()
    service = GoalService(repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation", current=0.0, target=1000.0)
    repo.get_by_id_and_user_id.return_value = mock_goal
    repo.get_contributions_by_goal_id.return_value = [{"id": 1, "amount": 100.0}]
    
    payload = GoalContributionCreate(amount=100.0, date="2026-09-27T00:00:00")
    
    goal = service.add_contribution(1, 1, payload)
    
    repo.create_contribution.assert_called_once()
    assert mock_goal.current == 100.0
    repo.update.assert_called_once_with(mock_goal)
