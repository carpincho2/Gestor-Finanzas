from typing import List
from fastapi import APIRouter, Depends, Request
from schemas import TransactionCreate
from security import get_current_user_id
from infrastructure.dependencies import get_transaction_service
from services.transaction_service import TransactionService

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

@router.get("")
async def get_transactions(request: Request, service: TransactionService = Depends(get_transaction_service)):
    user_id = get_current_user_id(request)
    txs = service.get_user_transactions(user_id)
    return {"ok": True, "transactions": txs}

@router.post("/cleanup-duplicates")
async def cleanup_duplicates(request: Request, service: TransactionService = Depends(get_transaction_service)):
    user_id = get_current_user_id(request)
    deleted_count = service.cleanup_duplicates(user_id)
    return {"ok": True, "deleted_count": deleted_count, "message": f"Se eliminaron {deleted_count} transacciones duplicadas."}

@router.post("", status_code=201)
async def create_transaction(payload: TransactionCreate, request: Request, service: TransactionService = Depends(get_transaction_service)):
    user_id = get_current_user_id(request)
    new_tx = service.create_transaction(user_id, payload)
    return {"ok": True, "transaction": new_tx}

@router.post("/bulk", status_code=201)
async def create_transactions_bulk(payload: List[TransactionCreate], request: Request, service: TransactionService = Depends(get_transaction_service)):
    user_id = get_current_user_id(request)
    created_count = service.create_transactions_bulk(user_id, payload)
    return {"ok": True, "message": f"{created_count} transacciones creadas exitosamente."}

@router.put("/{id}")
async def update_transaction(id: int, payload: TransactionCreate, request: Request, service: TransactionService = Depends(get_transaction_service)):
    user_id = get_current_user_id(request)
    tx = service.update_transaction(id, user_id, payload)
    return {"ok": True, "transaction": tx}

@router.delete("/all")
async def delete_all_transactions(request: Request, service: TransactionService = Depends(get_transaction_service)):
    user_id = get_current_user_id(request)
    service.delete_all_transactions(user_id)
    return {"ok": True, "message": "Todas las transacciones eliminadas y saldos reiniciados"}

@router.delete("/{id}")
async def delete_transaction(id: int, request: Request, service: TransactionService = Depends(get_transaction_service)):
    user_id = get_current_user_id(request)
    service.delete_transaction(id, user_id)
    return {"ok": True, "message": "Transacción eliminada"}
