from fastapi import APIRouter, Depends, Request
from schemas import BudgetCreate
from security import get_current_user_id
from infrastructure.dependencies import get_budget_service
from services.budget_service import BudgetService

router = APIRouter(prefix="/api/budgets", tags=["budgets"])

@router.get("")
async def get_budgets(request: Request, service: BudgetService = Depends(get_budget_service)):
    user_id = get_current_user_id(request)
    bgts = service.get_user_budgets(user_id)
    return {"ok": True, "budgets": bgts}

@router.post("", status_code=201)
async def create_budget(payload: BudgetCreate, request: Request, service: BudgetService = Depends(get_budget_service)):
    user_id = get_current_user_id(request)
    new_bgt = service.create_budget(user_id, payload)
    return {"ok": True, "budget": new_bgt}

@router.put("/{id}")
async def update_budget(id: int, payload: BudgetCreate, request: Request, service: BudgetService = Depends(get_budget_service)):
    user_id = get_current_user_id(request)
    bgt = service.update_budget(id, user_id, payload)
    return {"ok": True, "budget": bgt}

@router.delete("/{id}")
async def delete_budget(id: int, request: Request, service: BudgetService = Depends(get_budget_service)):
    user_id = get_current_user_id(request)
    service.delete_budget(id, user_id)
    return {"ok": True, "message": "Presupuesto eliminado"}
