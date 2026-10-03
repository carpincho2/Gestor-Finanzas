import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from services.goal_service import GoalService
from models import Goal, GoalContribution, Account
from schemas import GoalCreate, GoalContributionCreate

def test_get_user_goals():
    repo = MagicMock()
    service = GoalService(repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation", cat="travel", emoji="✈️", color="#fff", target=1000.0, current=0.0, status="active", currency="USD")
    repo.get_by_user_id.return_value = [mock_goal]
    repo.get_contributions_by_goal_id.return_value = []

    goals = service.get_user_goals(1)
    
    assert len(goals) == 1
    assert goals[0]["name"] == "Vacation"
    assert goals[0]["currency"] == "USD"
    assert goals[0]["contributions"] == []
    repo.get_by_user_id.assert_called_once_with(1)

def test_create_goal_with_currency_and_start_date():
    repo = MagicMock()
    service = GoalService(repo)
    
    payload = GoalCreate(name="Vacation", cat="travel", emoji="✈️", color="#fff", target=1000.0, current=0.0, currency="USD", start_date="2026-10-01", status="active")
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation", cat="travel", emoji="✈️", color="#fff", target=1000.0, current=0.0, currency="USD", start_date="2026-10-01", status="active")
    repo.create.return_value = mock_goal
    repo.get_contributions_by_goal_id.return_value = []

    goal = service.create_goal(1, payload)
    
    assert goal["id"] == 1
    assert goal["name"] == "Vacation"
    assert goal["currency"] == "USD"
    assert goal["start_date"] == "2026-10-01"
    repo.create.assert_called_once()

def test_update_goal_success():
    repo = MagicMock()
    service = GoalService(repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Old Vacation", cat="travel", emoji="✈️", color="#fff", target=1000.0, current=0.0, status="active", currency="ARS")
    repo.get_by_id_and_user_id.return_value = mock_goal
    repo.update.return_value = mock_goal
    repo.get_contributions_by_goal_id.return_value = []
    
    payload = GoalCreate(name="New Vacation", cat="travel", emoji="🏖️", color="#fff", target=2000.0, current=0.0, status="active", currency="USD")
    
    goal = service.update_goal(1, 1, payload)
    
    assert goal["name"] == "New Vacation"
    assert goal["target"] == 2000.0
    assert goal["currency"] == "USD"
    repo.get_by_id_and_user_id.assert_called_once_with(1, 1)
    repo.update.assert_called_once_with(mock_goal)

def test_toggle_status_pause_and_resume():
    repo = MagicMock()
    service = GoalService(repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation", status="active")
    repo.get_by_id_and_user_id.return_value = mock_goal
    repo.update.return_value = mock_goal
    repo.get_contributions_by_goal_id.return_value = []

    result = service.toggle_status(1, 1)
    assert mock_goal.status == "paused"
    assert result["status"] == "paused"

    result2 = service.toggle_status(1, 1, "active")
    assert mock_goal.status == "active"
    assert result2["status"] == "active"

def test_delete_goal_success():
    repo = MagicMock()
    service = GoalService(repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation")
    repo.get_by_id_and_user_id.return_value = mock_goal
    
    service.delete_goal(1, 1)
    
    repo.delete.assert_called_once_with(mock_goal)

def test_add_contribution_deposit_with_account():
    repo = MagicMock()
    acc_repo = MagicMock()
    service = GoalService(repo, acc_repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation", current=100.0, target=1000.0)
    mock_acc = Account(id=10, user_id=1, name="Banco", balance=500.0)
    
    repo.get_by_id_and_user_id.return_value = mock_goal
    repo.get_contributions_by_goal_id.return_value = []
    acc_repo.get_by_id_and_user_id.return_value = mock_acc
    
    payload = GoalContributionCreate(amount=200.0, date="2026-10-02", account_id=10, type="deposit")
    
    goal = service.add_contribution(1, 1, payload)
    
    repo.create_contribution.assert_called_once()
    assert mock_goal.current == 300.0
    assert mock_acc.balance == 300.0
    acc_repo.update.assert_called_once_with(mock_acc)

def test_add_contribution_withdraw_with_account():
    repo = MagicMock()
    acc_repo = MagicMock()
    service = GoalService(repo, acc_repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation", current=300.0, target=1000.0)
    mock_acc = Account(id=10, user_id=1, name="Banco", balance=300.0)
    
    repo.get_by_id_and_user_id.return_value = mock_goal
    repo.get_contributions_by_goal_id.return_value = []
    acc_repo.get_by_id_and_user_id.return_value = mock_acc
    
    payload = GoalContributionCreate(amount=100.0, date="2026-10-02", account_id=10, type="withdraw")
    
    goal = service.add_contribution(1, 1, payload)
    
    assert mock_goal.current == 200.0
    assert mock_acc.balance == 400.0
    acc_repo.update.assert_called_once_with(mock_acc)

def test_delete_contribution_reverses_balance():
    repo = MagicMock()
    acc_repo = MagicMock()
    service = GoalService(repo, acc_repo)
    
    mock_goal = Goal(id=1, user_id=1, name="Vacation", current=200.0, target=1000.0)
    mock_contrib = GoalContribution(id=99, goal_id=1, amount=100.0, date="2026-10-02", account_id=10, type="deposit")
    mock_acc = Account(id=10, user_id=1, name="Banco", balance=400.0)
    
    repo.get_by_id_and_user_id.return_value = mock_goal
    repo.get_contribution_by_id.return_value = mock_contrib
    repo.get_contributions_by_goal_id.return_value = []
    acc_repo.get_by_id_and_user_id.return_value = mock_acc
    
    goal = service.delete_contribution(1, 99, 1)
    
    assert mock_goal.current == 100.0
    assert mock_acc.balance == 500.0  # reversed deposit
    repo.delete_contribution.assert_called_once_with(mock_contrib)
    acc_repo.update.assert_called_once_with(mock_acc)
