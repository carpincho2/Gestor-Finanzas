import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from services.account_service import AccountService
from models import Account
from schemas import AccountCreate, AccountUpdate

def get_mock_repos():
    return {
        "account_repo": MagicMock(),
        "tx_repo": MagicMock(),
        "wallet_repo": MagicMock(),
        "user_repo": MagicMock()
    }

def test_get_user_accounts():
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    mock_account = Account(id=1, user_id=1, name="Test Account", balance=100.0)
    repos["account_repo"].get_by_user_id.return_value = [mock_account]

    accounts = service.get_user_accounts(1)
    
    assert len(accounts) == 1
    assert accounts[0].name == "Test Account"
    repos["account_repo"].get_by_user_id.assert_called_once_with(1)

def test_create_account():
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    payload = AccountCreate(name="New Account", type="CASH", balance=50.0, currency="ARS")
    
    mock_account = Account(id=1, user_id=1, name="New Account", type="CASH", balance=50.0, currency="ARS")
    repos["account_repo"].create.return_value = mock_account

    account = service.create_account(1, payload)
    
    assert account.id == 1
    assert account.name == "New Account"
    repos["account_repo"].create.assert_called_once()

def test_update_account_success():
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    mock_account = Account(id=1, user_id=1, name="Old Account", type="CASH", balance=50.0, currency="ARS")
    repos["account_repo"].get_by_id_and_user_id.return_value = mock_account
    repos["account_repo"].update.return_value = mock_account
    
    payload = AccountUpdate(name="Updated Account", type="CASH", balance=100.0, currency="ARS")
    
    account = service.update_account(1, 1, payload)
    
    assert account.name == "Updated Account"
    repos["account_repo"].get_by_id_and_user_id.assert_called_once_with(1, 1)
    repos["account_repo"].update.assert_called_once_with(mock_account)

def test_update_account_not_found():
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    repos["account_repo"].get_by_id_and_user_id.return_value = None
    
    payload = AccountUpdate(name="Updated Account", type="CASH", balance=100.0, currency="ARS")
    
    with pytest.raises(HTTPException) as excinfo:
        service.update_account(1, 1, payload)
        
    assert excinfo.value.status_code == 404

def test_delete_account_success():
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    mock_account = Account(id=1, user_id=1, name="Old Account")
    repos["account_repo"].get_by_id_and_user_id.return_value = mock_account
    
    service.delete_account(1, 1)
    
    repos["tx_repo"].delete_by_account_id.assert_called_once_with(1, 1)
    repos["wallet_repo"].delete_connections_by_account.assert_called_once_with(1, 1)
    repos["account_repo"].delete.assert_called_once_with(mock_account)

def test_delete_account_not_found():
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    repos["account_repo"].get_by_id_and_user_id.return_value = None
    
    with pytest.raises(HTTPException) as excinfo:
        service.delete_account(1, 1)
        
    assert excinfo.value.status_code == 404
