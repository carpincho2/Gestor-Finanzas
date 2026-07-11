from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Goal, GoalContribution
from schemas import GoalCreate, GoalContributionCreate
from security import get_current_user_id

router = APIRouter(prefix="/api/goals", tags=["goals"])

@router.get("")
async def get_goals(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    gls = db.query(Goal).filter(Goal.user_id == user_id).all()
    
    result = []
    for g in gls:
        contribs = db.query(GoalContribution).filter(GoalContribution.goal_id == g.id).order_by(GoalContribution.date.asc()).all()
        result.append({
            "id": g.id,
            "name": g.name,
            "cat": g.cat,
            "emoji": g.emoji,
            "color": g.color,
            "target": g.target,
            "current": g.current,
            "deadline": g.deadline,
            "notes": g.notes,
            "status": g.status,
            "contributions": contribs
        })
    return {"ok": True, "goals": result}

@router.post("", status_code=201)
async def create_goal(payload: GoalCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    new_goal = Goal(
        user_id=user_id,
        name=payload.name.strip(),
        cat=payload.cat,
        emoji=payload.emoji,
        color=payload.color,
        target=payload.target,
        current=payload.current,
        deadline=payload.deadline if payload.deadline else None,
        notes=payload.notes.strip() if payload.notes else None,
        status=payload.status
    )
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)
    return {"ok": True, "goal": {
        "id": new_goal.id,
        "name": new_goal.name,
        "cat": new_goal.cat,
        "emoji": new_goal.emoji,
        "color": new_goal.color,
        "target": new_goal.target,
        "current": new_goal.current,
        "deadline": new_goal.deadline,
        "notes": new_goal.notes,
        "status": new_goal.status,
        "contributions": []
    }}

@router.put("/{id}")
async def update_goal(id: int, payload: GoalCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    g = db.query(Goal).filter(Goal.id == id, Goal.user_id == user_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Objetivo no encontrado")
        
    g.name = payload.name.strip()
    g.cat = payload.cat
    g.emoji = payload.emoji
    g.color = payload.color
    g.target = payload.target
    g.current = payload.current
    g.deadline = payload.deadline if payload.deadline else None
    g.notes = payload.notes.strip() if payload.notes else None
    g.status = payload.status
    
    db.commit()
    db.refresh(g)
    
    contribs = db.query(GoalContribution).filter(GoalContribution.goal_id == g.id).order_by(GoalContribution.date.asc()).all()
    return {"ok": True, "goal": {
        "id": g.id,
        "name": g.name,
        "cat": g.cat,
        "emoji": g.emoji,
        "color": g.color,
        "target": g.target,
        "current": g.current,
        "deadline": g.deadline,
        "notes": g.notes,
        "status": g.status,
        "contributions": contribs
    }}

@router.delete("/{id}")
async def delete_goal(id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    g = db.query(Goal).filter(Goal.id == id, Goal.user_id == user_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Objetivo no encontrado")
        
    db.query(GoalContribution).filter(GoalContribution.goal_id == id).delete()
    
    db.delete(g)
    db.commit()
    return {"ok": True, "message": "Objetivo eliminado"}

@router.post("/{id}/contributions", status_code=201)
async def add_goal_contribution(id: int, payload: GoalContributionCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    g = db.query(Goal).filter(Goal.id == id, Goal.user_id == user_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Objetivo no encontrado")
        
    new_contrib = GoalContribution(
        goal_id=id,
        amount=payload.amount,
        date=payload.date,
        note=payload.note.strip() if payload.note else None
    )
    db.add(new_contrib)
    
    g.current += payload.amount
    
    db.commit()
    db.refresh(new_contrib)
    db.refresh(g)
    
    contribs = db.query(GoalContribution).filter(GoalContribution.goal_id == g.id).order_by(GoalContribution.date.asc()).all()
    return {"ok": True, "goal": {
        "id": g.id,
        "name": g.name,
        "cat": g.cat,
        "emoji": g.emoji,
        "color": g.color,
        "target": g.target,
        "current": g.current,
        "deadline": g.deadline,
        "notes": g.notes,
        "status": g.status,
        "contributions": contribs
    }}

@router.delete("/{goal_id}/contributions/{contrib_id}")
async def delete_goal_contribution(goal_id: int, contrib_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    g = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Objetivo no encontrado")
        
    contrib = db.query(GoalContribution).filter(GoalContribution.id == contrib_id, GoalContribution.goal_id == goal_id).first()
    if not contrib:
        raise HTTPException(status_code=404, detail="Contribución no encontrada")
        
    g.current = max(g.current - contrib.amount, 0.0)
    
    db.delete(contrib)
    db.commit()
    db.refresh(g)
    
    contribs = db.query(GoalContribution).filter(GoalContribution.goal_id == g.id).order_by(GoalContribution.date.asc()).all()
    return {"ok": True, "goal": {
        "id": g.id,
        "name": g.name,
        "cat": g.cat,
        "emoji": g.emoji,
        "color": g.color,
        "target": g.target,
        "current": g.current,
        "deadline": g.deadline,
        "notes": g.notes,
        "status": g.status,
        "contributions": contribs
    }}
