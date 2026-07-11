from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Budget
from schemas import BudgetCreate
from security import get_current_user_id

router = APIRouter(prefix="/api/budgets", tags=["budgets"])

@router.get("")
async def get_budgets(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    bgts = db.query(Budget).filter(Budget.user_id == user_id).all()
    return {"ok": True, "budgets": bgts}

@router.post("", status_code=201)
async def create_budget(payload: BudgetCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    new_bgt = Budget(
        user_id=user_id,
        cat=payload.cat,
        name=payload.name.strip(),
        icon=payload.icon,
        limit=payload.limit,
        color=payload.color,
        notes=payload.notes.strip() if payload.notes else None
    )
    db.add(new_bgt)
    db.commit()
    db.refresh(new_bgt)
    return {"ok": True, "budget": new_bgt}

@router.put("/{id}")
async def update_budget(id: int, payload: BudgetCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    bgt = db.query(Budget).filter(Budget.id == id, Budget.user_id == user_id).first()
    if not bgt:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        
    bgt.cat = payload.cat
    bgt.name = payload.name.strip()
    bgt.icon = payload.icon
    bgt.limit = payload.limit
    bgt.color = payload.color
    bgt.notes = payload.notes.strip() if payload.notes else None
    
    db.commit()
    db.refresh(bgt)
    return {"ok": True, "budget": bgt}

@router.delete("/{id}")
async def delete_budget(id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    bgt = db.query(Budget).filter(Budget.id == id, Budget.user_id == user_id).first()
    if not bgt:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        
    db.delete(bgt)
    db.commit()
    return {"ok": True, "message": "Presupuesto eliminado"}
