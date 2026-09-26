from typing import List, Optional

from sqlalchemy.orm import Session

from models import Transaction
from ports.repositories.transaction_repository_port import ITransactionRepository


class SQLAlchemyTransactionRepository(ITransactionRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_user_id(self, user_id: int) -> List[Transaction]:
        return self.db.query(Transaction).filter(Transaction.user_id == user_id).order_by(Transaction.date.desc(), Transaction.id.desc()).all()

    def get_by_user_id_asc(self, user_id: int) -> List[Transaction]:
        return self.db.query(Transaction).filter(Transaction.user_id == user_id).order_by(Transaction.id.asc()).all()

    def get_by_id_and_user_id(self, tx_id: int, user_id: int) -> Optional[Transaction]:
        return self.db.query(Transaction).filter(Transaction.id == tx_id, Transaction.user_id == user_id).first()

    def create(self, transaction: Transaction) -> Transaction:
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def create_bulk(self, transactions: List[Transaction]) -> List[Transaction]:
        self.db.add_all(transactions)
        self.db.commit()
        return transactions

    def update(self, transaction: Transaction) -> Transaction:
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def delete(self, transaction: Transaction) -> None:
        self.db.delete(transaction)
        self.db.commit()

    def delete_all_by_user_id(self, user_id: int) -> None:
        self.db.query(Transaction).filter(Transaction.user_id == user_id).delete()
        self.db.commit()

    def delete_by_account_id(self, account_id: int, user_id: int) -> None:
        self.db.query(Transaction).filter(
            Transaction.account_id == account_id, 
            Transaction.user_id == user_id
        ).delete()
        self.db.commit()
