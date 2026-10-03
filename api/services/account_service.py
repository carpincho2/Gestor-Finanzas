import os
import time as _time
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple

from fastapi import HTTPException

from models import Account, Transaction, WalletConnection, SyncLog, User
from ports.repositories.account_repository_port import IAccountRepository
from ports.repositories.transaction_repository_port import ITransactionRepository
from ports.repositories.wallet_repository_port import IWalletRepository
from ports.repositories.user_repository_port import IUserRepository
from schemas import AccountCreate, AccountUpdate, AccountTokenRequest, AccountTransferRequest, AccountReconcileRequest
from security import token_crypto
from wallet_adapters import get_adapter


class AccountService:
    def __init__(
        self, 
        account_repo: IAccountRepository, 
        tx_repo: ITransactionRepository, 
        wallet_repo: IWalletRepository,
        user_repo: IUserRepository
    ):
        self.account_repo = account_repo
        self.tx_repo = tx_repo
        self.wallet_repo = wallet_repo
        self.user_repo = user_repo

    def get_user_accounts(self, user_id: int) -> List[Account]:
        return self.account_repo.get_by_user_id(user_id)

    def create_account(self, user_id: int, payload: AccountCreate) -> Account:
        new_acc = Account(
            user_id=user_id,
            name=payload.name.strip(),
            type=payload.type,
            bank=payload.bank.strip() if payload.bank else None,
            balance=payload.balance,
            currency=payload.currency,
            limit=payload.limit,
            notes=payload.notes.strip() if payload.notes else None,
            mp_token=payload.mp_token.strip() if payload.mp_token else None,
            is_archived=payload.is_archived if payload.is_archived is not None else False,
            is_favorite=payload.is_favorite if payload.is_favorite is not None else False,
            color=payload.color.strip() if payload.color else None,
            icon=payload.icon.strip() if payload.icon else None,
            cbu=payload.cbu.strip() if payload.cbu else None,
            alias=payload.alias.strip() if payload.alias else None,
            closing_day=payload.closing_day,
            due_day=payload.due_day
        )
        return self.account_repo.create(new_acc)

    def update_account(self, account_id: int, user_id: int, payload: AccountUpdate) -> Account:
        acc = self.account_repo.get_by_id_and_user_id(account_id, user_id)
        if not acc:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        
        acc.name = payload.name.strip()
        acc.type = payload.type
        acc.bank = payload.bank.strip() if payload.bank else None
        acc.balance = payload.balance
        acc.currency = payload.currency
        acc.limit = payload.limit
        acc.notes = payload.notes.strip() if payload.notes else None
        acc.mp_token = payload.mp_token.strip() if payload.mp_token else None
        if payload.is_archived is not None:
            acc.is_archived = payload.is_archived
        if payload.is_favorite is not None:
            acc.is_favorite = payload.is_favorite
        acc.color = payload.color.strip() if payload.color else None
        acc.icon = payload.icon.strip() if payload.icon else None
        acc.cbu = payload.cbu.strip() if payload.cbu else None
        acc.alias = payload.alias.strip() if payload.alias else None
        acc.closing_day = payload.closing_day
        acc.due_day = payload.due_day
        
        return self.account_repo.update(acc)

    def toggle_archive(self, account_id: int, user_id: int) -> Account:
        acc = self.account_repo.get_by_id_and_user_id(account_id, user_id)
        if not acc:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        acc.is_archived = not acc.is_archived
        return self.account_repo.update(acc)

    def toggle_favorite(self, account_id: int, user_id: int) -> Account:
        acc = self.account_repo.get_by_id_and_user_id(account_id, user_id)
        if not acc:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        acc.is_favorite = not acc.is_favorite
        return self.account_repo.update(acc)

    def reconcile_balance(self, account_id: int, user_id: int, payload: AccountReconcileRequest) -> Dict[str, Any]:
        acc = self.account_repo.get_by_id_and_user_id(account_id, user_id)
        if not acc:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        
        diff = round(payload.real_balance - acc.balance, 2)
        created_tx = None
        if abs(diff) >= 0.01:
            tx_type = "income" if diff > 0 else "expense"
            tx_desc = payload.note.strip() if payload.note else "Ajuste de saldo"
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            
            new_tx = Transaction(
                user_id=user_id,
                account_id=acc.id,
                type=tx_type,
                desc=f"{tx_desc} ({'+' if diff > 0 else ''}{diff})",
                amount=abs(diff),
                cat="Otros",
                date=today_str
            )
            created_tx = self.tx_repo.create(new_tx)
            
        acc.balance = payload.real_balance
        updated_acc = self.account_repo.update(acc)
        return {
            "account": updated_acc,
            "diff": diff,
            "transaction": created_tx
        }

    def transfer_between_accounts(self, user_id: int, payload: AccountTransferRequest) -> Dict[str, Any]:
        if payload.from_account_id == payload.to_account_id:
            raise HTTPException(status_code=400, detail="Las cuentas de origen y destino deben ser distintas")
        if payload.amount_from <= 0 or payload.amount_to <= 0:
            raise HTTPException(status_code=400, detail="Los montos de transferencia deben ser mayores a cero")
            
        from_acc = self.account_repo.get_by_id_and_user_id(payload.from_account_id, user_id)
        to_acc = self.account_repo.get_by_id_and_user_id(payload.to_account_id, user_id)
        
        if not from_acc:
            raise HTTPException(status_code=404, detail="Cuenta de origen no encontrada")
        if not to_acc:
            raise HTTPException(status_code=404, detail="Cuenta de destino no encontrada")
            
        from_acc.balance -= payload.amount_from
        to_acc.balance += payload.amount_to
        
        link_id = int(_time.time() * 1000)
        date_str = payload.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        tx_out = Transaction(
            user_id=user_id,
            account_id=from_acc.id,
            type="expense",
            desc=payload.desc_expense or f"Transferencia → {to_acc.name}",
            amount=payload.amount_from,
            cat="Otros",
            date=date_str,
            transfer_id=link_id
        )
        tx_in = Transaction(
            user_id=user_id,
            account_id=to_acc.id,
            type="income",
            desc=payload.desc_income or f"Transferencia ← {from_acc.name}",
            amount=payload.amount_to,
            cat="Otros",
            date=date_str,
            transfer_id=link_id
        )
        
        self.tx_repo.create_bulk([tx_out, tx_in])
        self.account_repo.update(from_acc)
        self.account_repo.update(to_acc)
        
        return {
            "ok": True,
            "transfer_id": link_id,
            "from_account": from_acc,
            "to_account": to_acc,
            "expense_tx": tx_out,
            "income_tx": tx_in
        }

    def delete_account(self, account_id: int, user_id: int) -> None:
        acc = self.account_repo.get_by_id_and_user_id(account_id, user_id)
        if not acc:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
            
        self.tx_repo.delete_by_account_id(account_id, user_id)
        self.wallet_repo.delete_connections_by_account(account_id, user_id)
        self.account_repo.delete(acc)
