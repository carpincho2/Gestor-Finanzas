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
