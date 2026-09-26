import os
import time as _time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

from fastapi import HTTPException

from models import Account, Transaction, WalletConnection, SyncLog, User
from ports.repositories.account_repository_port import IAccountRepository
from ports.repositories.transaction_repository_port import ITransactionRepository
from ports.repositories.wallet_repository_port import IWalletRepository
from ports.repositories.user_repository_port import IUserRepository
from schemas import AccountCreate, AccountUpdate, AccountTokenRequest
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
            mp_token=payload.mp_token.strip() if payload.mp_token else None
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
        
        return self.account_repo.update(acc)

    def delete_account(self, account_id: int, user_id: int) -> None:
        acc = self.account_repo.get_by_id_and_user_id(account_id, user_id)
        if not acc:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
            
        self.tx_repo.delete_by_account_id(account_id, user_id)
        self.wallet_repo.delete_connections_by_account(account_id, user_id)
        self.account_repo.delete(acc)
