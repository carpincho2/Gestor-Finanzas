from typing import List, Optional

from sqlalchemy.orm import Session

from models import Account
from ports.repositories.account_repository_port import IAccountRepository


class SQLAlchemyAccountRepository(IAccountRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_user_id(self, user_id: int) -> List[Account]:
        return self.db.query(Account).filter(Account.user_id == user_id).order_by(Account.created_at.desc()).all()

    def get_by_id_and_user_id(self, account_id: int, user_id: int) -> Optional[Account]:
        return self.db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()

    def create(self, account: Account) -> Account:
        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        return account

    def update(self, account: Account) -> Account:
        self.db.commit()
        self.db.refresh(account)
        return account

    def delete(self, account: Account) -> None:
        self.db.delete(account)
        self.db.commit()

    def reset_balances(self, user_id: int) -> None:
        self.db.query(Account).filter(Account.user_id == user_id).update({Account.balance: 0.0})
        self.db.commit()
