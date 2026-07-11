from typing import List
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Transaction, Account
from schemas import TransactionCreate
from security import get_current_user_id

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

@router.get("")
async def get_transactions(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    txs = db.query(Transaction).filter(Transaction.user_id == user_id).order_by(Transaction.date.desc(), Transaction.id.desc()).all()
    return {"ok": True, "transactions": txs}

@router.post("/cleanup-duplicates")
async def cleanup_duplicates(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
    txs = db.query(Transaction).filter(Transaction.user_id == user_id).order_by(Transaction.id.asc()).all()
    
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
        db.delete(tx)
        
    db.commit()
    
    return {"ok": True, "deleted_count": deleted_count, "message": f"Se eliminaron {deleted_count} transacciones duplicadas."}

@router.post("", status_code=201)
async def create_transaction(payload: TransactionCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
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
    db.add(new_tx)
    
    if payload.account_id:
        acc = db.query(Account).filter(Account.id == payload.account_id, Account.user_id == user_id).first()
        if not acc:
            raise HTTPException(status_code=403, detail="Cuenta inválida o no pertenece al usuario")
            
        if payload.type == "income":
            acc.balance += payload.amount
        else:
            acc.balance -= payload.amount
    db.commit()
    db.refresh(new_tx)
    return {"ok": True, "transaction": new_tx}

@router.post("/bulk", status_code=201)
async def create_transactions_bulk(payload: List[TransactionCreate], request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
    account_balances = {}
    
    new_transactions = []
    for tx_data in payload:
        if tx_data.account_id:
            acc = db.query(Account).filter(Account.id == tx_data.account_id, Account.user_id == user_id).first()
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
        db.add(new_tx)
        new_transactions.append(new_tx)
        
        if tx_data.account_id:
            if tx_data.account_id not in account_balances:
                account_balances[tx_data.account_id] = 0
                
            if tx_data.type == "income":
                account_balances[tx_data.account_id] += tx_data.amount
            else:
                account_balances[tx_data.account_id] -= tx_data.amount
                
    for acc_id, balance_diff in account_balances.items():
        if balance_diff != 0:
            acc = db.query(Account).filter(Account.id == acc_id, Account.user_id == user_id).first()
            if acc:
                acc.balance += balance_diff
                
    db.commit()
    return {"ok": True, "message": f"{len(new_transactions)} transacciones creadas exitosamente."}

@router.put("/{id}")
async def update_transaction(id: int, payload: TransactionCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    tx = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == user_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
        
    if tx.account_id:
        old_acc = db.query(Account).filter(Account.id == tx.account_id, Account.user_id == user_id).first()
        if old_acc:
            if tx.type == "income":
                old_acc.balance -= tx.amount
            else:
                old_acc.balance += tx.amount
                
    tx.account_id = payload.account_id
    tx.type = payload.type
    tx.desc = payload.desc.strip()
    tx.amount = payload.amount
    tx.cat = payload.cat
    tx.date = payload.date
    tx.transfer_id = payload.transfer_id
    
    if payload.account_id:
        new_acc = db.query(Account).filter(Account.id == payload.account_id, Account.user_id == user_id).first()
        if not new_acc:
            raise HTTPException(status_code=403, detail="Cuenta de destino inválida o no pertenece al usuario")
            
        if payload.type == "income":
            new_acc.balance += payload.amount
        else:
            new_acc.balance -= payload.amount
    db.commit()
    db.refresh(tx)
    return {"ok": True, "transaction": tx}

@router.delete("/all")
async def delete_all_transactions(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
    db.query(Transaction).filter(Transaction.user_id == user_id).delete()
    db.query(Account).filter(Account.user_id == user_id).update({Account.balance: 0.0})
    
    db.commit()
    return {"ok": True, "message": "Todas las transacciones eliminadas y saldos reiniciados"}

@router.delete("/{id}")
async def delete_transaction(id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    tx = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == user_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
        
    if tx.account_id:
        acc = db.query(Account).filter(Account.id == tx.account_id, Account.user_id == user_id).first()
        if acc:
            if tx.type == "income":
                acc.balance -= tx.amount
            else:
                acc.balance += tx.amount
                
    db.delete(tx)
    db.commit()
    return {"ok": True, "message": "Transacción eliminada"}
