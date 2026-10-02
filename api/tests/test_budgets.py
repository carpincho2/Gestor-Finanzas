import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from services.budget_service import BudgetService
from models import Budget
from schemas import BudgetCreate

def test_get_user_budgets():
    repo = MagicMock()
    service = BudgetService(repo)
    
    mock_bgt = Budget(id=1, user_id=1, name="Groceries", limit=500.0, currency="ARS")
    repo.get_by_user_id.return_value = [mock_bgt]

    budgets = service.get_user_budgets(1)
    
    assert len(budgets) == 1
    assert budgets[0].name == "Groceries"
    assert budgets[0].currency == "ARS"
    repo.get_by_user_id.assert_called_once_with(1)

def test_create_budget():
    repo = MagicMock()
    service = BudgetService(repo)
    
    payload = BudgetCreate(cat="food", name="Groceries", icon="apple", limit=500.0, color="#fff", currency="USD")
    
    mock_bgt = Budget(id=1, user_id=1, cat="food", name="Groceries", icon="apple", limit=500.0, color="#fff", currency="USD")
    repo.create.return_value = mock_bgt

    budget = service.create_budget(1, payload)
    
    assert budget.id == 1
    assert budget.name == "Groceries"
    assert budget.currency == "USD"
    repo.create.assert_called_once()
    created_arg = repo.create.call_args[0][0]
    assert created_arg.currency == "USD"

def test_update_budget_success():
    repo = MagicMock()
    service = BudgetService(repo)
    
    mock_bgt = Budget(id=1, user_id=1, cat="food", name="Old Groceries", icon="apple", limit=500.0, color="#fff", currency="ARS")
    repo.get_by_id_and_user_id.return_value = mock_bgt
    repo.update.return_value = mock_bgt
    
    payload = BudgetCreate(cat="food", name="New Groceries", icon="apple", limit=600.0, color="#fff", currency="USD")
    
    budget = service.update_budget(1, 1, payload)
    
    assert budget.name == "New Groceries"
    assert budget.limit == 600.0
    assert budget.currency == "USD"
    repo.get_by_id_and_user_id.assert_called_once_with(1, 1)
    repo.update.assert_called_once_with(mock_bgt)

def test_update_budget_not_found():
    repo = MagicMock()
    service = BudgetService(repo)
    
    repo.get_by_id_and_user_id.return_value = None
    
    payload = BudgetCreate(cat="food", name="New Groceries", icon="apple", limit=600.0, color="#fff")
    
    with pytest.raises(HTTPException) as excinfo:
        service.update_budget(1, 1, payload)
        
    assert excinfo.value.status_code == 404

def test_delete_budget_success():
    repo = MagicMock()
    service = BudgetService(repo)
    
    mock_bgt = Budget(id=1, user_id=1, name="Groceries")
    repo.get_by_id_and_user_id.return_value = mock_bgt
    
    service.delete_budget(1, 1)
    
    repo.delete.assert_called_once_with(mock_bgt)

def test_delete_budget_not_found():
    repo = MagicMock()
    service = BudgetService(repo)
    
    repo.get_by_id_and_user_id.return_value = None
    
    with pytest.raises(HTTPException) as excinfo:
        service.delete_budget(1, 1)
        
    assert excinfo.value.status_code == 404
