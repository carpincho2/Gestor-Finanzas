from typing import List, Dict, Any

from fastapi import HTTPException

from models import Transaction
from ports.repositories.transaction_repository_port import ITransactionRepository
from ports.repositories.account_repository_port import IAccountRepository
from schemas import TransactionCreate


class TransactionService:
    def __init__(self, tx_repository: ITransactionRepository, account_repository: IAccountRepository):
        self.tx_repository = tx_repository
        self.account_repository = account_repository

    def get_user_transactions(self, user_id: int) -> List[Transaction]:
        return self.tx_repository.get_by_user_id(user_id)

    def cleanup_duplicates(self, user_id: int) -> int:
        txs = self.tx_repository.get_by_user_id_asc(user_id)
        seen = set()
        to_delete = []
        
        for tx in txs:
            key = (tx.account_id, tx.amount, tx.date, tx.desc)
            if key in seen:
                to_delete.append(tx)
            else:
                seen.add(key)
                
        deleted_count = len(to_delete)
        for tx in to_delete:
            self.tx_repository.delete(tx)
            
        return deleted_count

    def create_transaction(self, user_id: int, payload: TransactionCreate) -> Transaction:
        new_tx = Transaction(
            user_id=user_id,
            account_id=payload.account_id,
            type=payload.type,
            desc=payload.desc.strip(),
            amount=payload.amount,
            cat=payload.cat,
            date=payload.date,
            transfer_id=payload.transfer_id
        )
        
        if payload.account_id:
            acc = self.account_repository.get_by_id_and_user_id(payload.account_id, user_id)
            if not acc:
                raise HTTPException(status_code=403, detail="Cuenta inválida o no pertenece al usuario")
                
            if payload.type == "income":
                acc.balance += payload.amount
            else:
                acc.balance -= payload.amount
            self.account_repository.update(acc)
            
        return self.tx_repository.create(new_tx)

    def create_transactions_bulk(self, user_id: int, payload: List[TransactionCreate]) -> int:
        account_balances = {}
        new_transactions = []
        
        for tx_data in payload:
            if tx_data.account_id:
                acc = self.account_repository.get_by_id_and_user_id(tx_data.account_id, user_id)
                if not acc:
                    raise HTTPException(status_code=403, detail="Una de las cuentas indicadas es inválida o no pertenece al usuario")
                    
            new_tx = Transaction(
                user_id=user_id,
                account_id=tx_data.account_id,
                type=tx_data.type,
                desc=tx_data.desc.strip(),
                amount=tx_data.amount,
                cat=tx_data.cat,
                date=tx_data.date,
                transfer_id=tx_data.transfer_id
            )
            new_transactions.append(new_tx)
            
            if tx_data.account_id:
                if tx_data.account_id not in account_balances:
                    account_balances[tx_data.account_id] = 0
                    
                if tx_data.type == "income":
                    account_balances[tx_data.account_id] += tx_data.amount
                else:
                    account_balances[tx_data.account_id] -= tx_data.amount
                    
        self.tx_repository.create_bulk(new_transactions)
        
        for acc_id, balance_diff in account_balances.items():
            if balance_diff != 0:
                acc = self.account_repository.get_by_id_and_user_id(acc_id, user_id)
                if acc:
                    acc.balance += balance_diff
                    self.account_repository.update(acc)
                    
        return len(new_transactions)

    def update_transaction(self, tx_id: int, user_id: int, payload: TransactionCreate) -> Transaction:
        tx = self.tx_repository.get_by_id_and_user_id(tx_id, user_id)
        if not tx:
            raise HTTPException(status_code=404, detail="Transacción no encontrada")
            
        if tx.account_id:
            old_acc = self.account_repository.get_by_id_and_user_id(tx.account_id, user_id)
            if old_acc:
                if tx.type == "income":
                    old_acc.balance -= tx.amount
                else:
                    old_acc.balance += tx.amount
                self.account_repository.update(old_acc)
                    
        tx.account_id = payload.account_id
        tx.type = payload.type
        tx.desc = payload.desc.strip()
        tx.amount = payload.amount
        tx.cat = payload.cat
        tx.date = payload.date
        tx.transfer_id = payload.transfer_id
        
        if payload.account_id:
            new_acc = self.account_repository.get_by_id_and_user_id(payload.account_id, user_id)
            if not new_acc:
                raise HTTPException(status_code=403, detail="Cuenta de destino inválida o no pertenece al usuario")
                
            if payload.type == "income":
                new_acc.balance += payload.amount
            else:
                new_acc.balance -= payload.amount
            self.account_repository.update(new_acc)
            
        return self.tx_repository.update(tx)

    def delete_transaction(self, tx_id: int, user_id: int) -> None:
        tx = self.tx_repository.get_by_id_and_user_id(tx_id, user_id)
        if not tx:
            raise HTTPException(status_code=404, detail="Transacción no encontrada")
            
        if tx.account_id:
            acc = self.account_repository.get_by_id_and_user_id(tx.account_id, user_id)
            if acc:
                if tx.type == "income":
                    acc.balance -= tx.amount
                else:
                    acc.balance += tx.amount
                self.account_repository.update(acc)
                    
        self.tx_repository.delete(tx)

    def delete_all_transactions(self, user_id: int) -> None:
        self.tx_repository.delete_all_by_user_id(user_id)
        self.account_repository.reset_balances(user_id)
