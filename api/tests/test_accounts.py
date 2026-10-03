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

def test_toggle_archive():
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    mock_account = Account(id=1, user_id=1, name="Cuenta", is_archived=False)
    repos["account_repo"].get_by_id_and_user_id.return_value = mock_account
    repos["account_repo"].update.side_effect = lambda a: a
    
    acc = service.toggle_archive(1, 1)
    assert acc.is_archived is True
    
    acc2 = service.toggle_archive(1, 1)
    assert acc2.is_archived is False

def test_toggle_favorite():
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    mock_account = Account(id=1, user_id=1, name="Cuenta", is_favorite=False)
    repos["account_repo"].get_by_id_and_user_id.return_value = mock_account
    repos["account_repo"].update.side_effect = lambda a: a
    
    acc = service.toggle_favorite(1, 1)
    assert acc.is_favorite is True

def test_reconcile_balance():
    from schemas import AccountReconcileRequest
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    mock_account = Account(id=1, user_id=1, name="Galicia", balance=100.0)
    repos["account_repo"].get_by_id_and_user_id.return_value = mock_account
    repos["account_repo"].update.side_effect = lambda a: a
    
    # 1. Ajuste positivo (falta dinero en app -> Ingreso)
    res = service.reconcile_balance(1, 1, AccountReconcileRequest(real_balance=150.0, note="Conciliación"))
    assert res["diff"] == 50.0
    assert res["account"].balance == 150.0
    repos["tx_repo"].create.assert_called_once()
    assert repos["tx_repo"].create.call_args[0][0].type == "income"
    assert repos["tx_repo"].create.call_args[0][0].amount == 50.0

def test_transfer_between_accounts_success():
    from schemas import AccountTransferRequest
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    from_acc = Account(id=1, user_id=1, name="Galicia", balance=1000.0)
    to_acc = Account(id=2, user_id=1, name="Mercado Pago", balance=200.0)
    
    repos["account_repo"].get_by_id_and_user_id.side_effect = lambda aid, uid: from_acc if aid == 1 else to_acc
    
    payload = AccountTransferRequest(
        from_account_id=1,
        to_account_id=2,
        amount_from=300.0,
        amount_to=300.0,
        desc_expense="Transferencia a MP",
        desc_income="Transferencia desde Galicia"
    )
    
    res = service.transfer_between_accounts(1, payload)
    assert res["ok"] is True
    assert from_acc.balance == 700.0
    assert to_acc.balance == 500.0
    repos["tx_repo"].create_bulk.assert_called_once()

def test_transfer_same_account_error():
    from schemas import AccountTransferRequest
    repos = get_mock_repos()
    service = AccountService(**repos)
    
    payload = AccountTransferRequest(
        from_account_id=1,
        to_account_id=1,
        amount_from=100.0,
        amount_to=100.0
    )
    with pytest.raises(HTTPException) as exc:
        service.transfer_between_accounts(1, payload)
    assert exc.value.status_code == 400

