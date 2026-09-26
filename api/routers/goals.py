from fastapi import APIRouter, Depends, Request
from schemas import GoalCreate, GoalContributionCreate
from security import get_current_user_id
from infrastructure.dependencies import get_goal_service
from services.goal_service import GoalService

router = APIRouter(prefix="/api/goals", tags=["goals"])

@router.get("")
async def get_goals(request: Request, service: GoalService = Depends(get_goal_service)):
    user_id = get_current_user_id(request)
    goals = service.get_user_goals(user_id)
    return {"ok": True, "goals": goals}

@router.post("", status_code=201)
async def create_goal(payload: GoalCreate, request: Request, service: GoalService = Depends(get_goal_service)):
    user_id = get_current_user_id(request)
    new_goal = service.create_goal(user_id, payload)
    return {"ok": True, "goal": new_goal}

@router.put("/{id}")
async def update_goal(id: int, payload: GoalCreate, request: Request, service: GoalService = Depends(get_goal_service)):
    user_id = get_current_user_id(request)
    updated = service.update_goal(id, user_id, payload)
    return {"ok": True, "goal": updated}

@router.delete("/{id}")
async def delete_goal(id: int, request: Request, service: GoalService = Depends(get_goal_service)):
    user_id = get_current_user_id(request)
    service.delete_goal(id, user_id)
    return {"ok": True, "message": "Objetivo eliminado"}

@router.post("/{id}/contributions", status_code=201)
async def add_goal_contribution(id: int, payload: GoalContributionCreate, request: Request, service: GoalService = Depends(get_goal_service)):
    user_id = get_current_user_id(request)
    updated_goal = service.add_contribution(id, user_id, payload)
    return {"ok": True, "goal": updated_goal}

@router.delete("/{goal_id}/contributions/{contrib_id}")
async def delete_goal_contribution(goal_id: int, contrib_id: int, request: Request, service: GoalService = Depends(get_goal_service)):
    user_id = get_current_user_id(request)
    updated_goal = service.delete_contribution(goal_id, contrib_id, user_id)
    return {"ok": True, "goal": updated_goal}
