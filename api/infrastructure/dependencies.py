from fastapi import Depends
from sqlalchemy.orm import Session
from database import get_db

from infrastructure.repositories.sqlalchemy_user_repository import SQLAlchemyUserRepository
from infrastructure.repositories.sqlalchemy_price_repository import SQLAlchemyPriceRepository
from application.use_cases.auth_use_cases import AuthUseCases
from application.use_cases.sepa_use_cases import SepaUseCases

def get_user_repository(db: Session = Depends(get_db)) -> SQLAlchemyUserRepository:
    return SQLAlchemyUserRepository(db)

def get_price_repository(db: Session = Depends(get_db)) -> SQLAlchemyPriceRepository:
    return SQLAlchemyPriceRepository(db)

def get_auth_use_cases(user_repo: SQLAlchemyUserRepository = Depends(get_user_repository)) -> AuthUseCases:
    return AuthUseCases(user_repo)

def get_sepa_use_cases(price_repo: SQLAlchemyPriceRepository = Depends(get_price_repository)) -> SepaUseCases:
    return SepaUseCases(price_repo)

from infrastructure.repositories.sqlalchemy_budget_repository import SQLAlchemyBudgetRepository
from services.budget_service import BudgetService

def get_budget_repository(db: Session = Depends(get_db)) -> SQLAlchemyBudgetRepository:
    return SQLAlchemyBudgetRepository(db)

def get_budget_service(budget_repo: SQLAlchemyBudgetRepository = Depends(get_budget_repository)) -> BudgetService:
    return BudgetService(budget_repo)

from infrastructure.repositories.sqlalchemy_goal_repository import SQLAlchemyGoalRepository
from services.goal_service import GoalService

def get_goal_repository(db: Session = Depends(get_db)) -> SQLAlchemyGoalRepository:
    return SQLAlchemyGoalRepository(db)

def get_goal_service(goal_repo: SQLAlchemyGoalRepository = Depends(get_goal_repository)) -> GoalService:
    return GoalService(goal_repo)

from infrastructure.repositories.sqlalchemy_account_repository import SQLAlchemyAccountRepository
from infrastructure.repositories.sqlalchemy_transaction_repository import SQLAlchemyTransactionRepository
from infrastructure.repositories.sqlalchemy_wallet_repository import SQLAlchemyWalletRepository
from services.transaction_service import TransactionService
from services.account_service import AccountService

def get_account_repository(db: Session = Depends(get_db)) -> SQLAlchemyAccountRepository:
    return SQLAlchemyAccountRepository(db)

def get_transaction_repository(db: Session = Depends(get_db)) -> SQLAlchemyTransactionRepository:
    return SQLAlchemyTransactionRepository(db)

def get_wallet_repository(db: Session = Depends(get_db)) -> SQLAlchemyWalletRepository:
    return SQLAlchemyWalletRepository(db)

def get_transaction_service(
    tx_repo: SQLAlchemyTransactionRepository = Depends(get_transaction_repository),
    acc_repo: SQLAlchemyAccountRepository = Depends(get_account_repository)
) -> TransactionService:
    return TransactionService(tx_repo, acc_repo)

def get_account_service(
    account_repo: SQLAlchemyAccountRepository = Depends(get_account_repository),
    tx_repo: SQLAlchemyTransactionRepository = Depends(get_transaction_repository),
    wallet_repo: SQLAlchemyWalletRepository = Depends(get_wallet_repository),
    user_repo: SQLAlchemyUserRepository = Depends(get_user_repository)
) -> AccountService:
    return AccountService(account_repo, tx_repo, wallet_repo, user_repo)


