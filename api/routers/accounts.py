import os
import time as _time
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Account, Transaction, WalletConnection, SyncLog, User
from schemas import AccountCreate, AccountUpdate, AccountTokenRequest
from security import get_current_user_id, token_crypto
from wallet_adapters import get_adapter

router = APIRouter(prefix="/api/accounts", tags=["accounts"])

@router.get("")
async def get_accounts(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    accs = db.query(Account).filter(Account.user_id == user_id).all()
    return {"ok": True, "accounts": accs}

@router.post("", status_code=201)
async def create_account(payload: AccountCreate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    new_acc = Account(
        user_id=user_id,
        name=payload.name.strip(),
        type=payload.type,
        bank=payload.bank.strip() if payload.bank else None,
        balance=payload.balance,
        currency=payload.currency,
        limit=payload.limit,
        notes=payload.notes.strip() if payload.notes else None,
        mp_token=payload.mp_token.strip() if payload.mp_token else None
    )
    db.add(new_acc)
    db.commit()
    db.refresh(new_acc)
    return {"ok": True, "account": new_acc}

@router.put("/{id}")
async def update_account(id: int, payload: AccountUpdate, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    acc = db.query(Account).filter(Account.id == id, Account.user_id == user_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    acc.name = payload.name.strip()
    acc.type = payload.type
    acc.bank = payload.bank.strip() if payload.bank else None
    acc.balance = payload.balance
    acc.currency = payload.currency
    acc.limit = payload.limit
    acc.notes = payload.notes.strip() if payload.notes else None
    acc.mp_token = payload.mp_token.strip() if payload.mp_token else None
    
    db.commit()
    db.refresh(acc)
    return {"ok": True, "account": acc}

@router.delete("/{id}")
async def delete_account(id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    acc = db.query(Account).filter(Account.id == id, Account.user_id == user_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    db.query(Transaction).filter(
        Transaction.account_id == id, 
        Transaction.user_id == user_id
    ).delete()

    db.query(WalletConnection).filter(
        WalletConnection.account_id == id,
        WalletConnection.user_id == user_id
    ).delete()
    
    db.delete(acc)
    db.commit()
    return {"ok": True, "message": "Cuenta eliminada"}

@router.put("/{id}/token")
async def update_account_token(id: int, payload: AccountTokenRequest, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    acc = db.query(Account).filter(Account.id == id, Account.user_id == user_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    token_value = payload.mp_token.strip()
    is_mock = token_value.lower() in ["mock-token", "test-token", "pruebas"]
    encrypted_token = token_value if is_mock else token_crypto.encrypt(token_value)
    
    acc.mp_token = encrypted_token
    
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == id,
        WalletConnection.user_id == user_id,
        WalletConnection.provider == "mercadopago"
    ).first()
    
    if wallet_conn:
        wallet_conn.access_token_encrypted = encrypted_token
        wallet_conn.status = "active"
    else:
        wallet_conn = WalletConnection(
            user_id=user_id,
            account_id=id,
            provider="mercadopago",
            access_token_encrypted=encrypted_token,
            status="active",
        )
        db.add(wallet_conn)
    
    db.commit()
    db.refresh(acc)
    return {"ok": True, "message": "Token de Mercado Pago actualizado correctamente"}

@router.post("/{id}/sync")
async def sync_account_transactions(id: int, request: Request, db: Session = Depends(get_db)):
    sync_start = _time.time()
    
    user_id = get_current_user_id(request)
    acc = db.query(Account).filter(Account.id == id, Account.user_id == user_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == id,
        WalletConnection.user_id == user_id,
        WalletConnection.provider == "mercadopago"
    ).first()
    
    token = ""
    if wallet_conn and wallet_conn.access_token_encrypted:
        token = token_crypto.decrypt(wallet_conn.access_token_encrypted)
    elif acc.mp_token:
        token = token_crypto.decrypt(acc.mp_token)
    
    if not token:
        token = os.getenv("MP_ACCESS_TOKEN", "").strip()
        
    if not token:
        return JSONResponse(status_code=400, content={"error": "Token de acceso de Mercado Pago no configurado para esta cuenta"})
    
    if wallet_conn and wallet_conn.token_expires_at:
        time_until_expiry = wallet_conn.token_expires_at - datetime.utcnow()
        if time_until_expiry.total_seconds() < 600:
            if wallet_conn.refresh_token_encrypted:
                try:
                    adapter = get_adapter(wallet_conn.provider)
                    if not adapter:
                        raise Exception(f"Adaptador para {wallet_conn.provider} no encontrado")
                    refresh_token = token_crypto.decrypt(wallet_conn.refresh_token_encrypted)
                    new_tokens = adapter.refresh_access_token(refresh_token)
                    
                    wallet_conn.access_token_encrypted = token_crypto.encrypt(new_tokens["access_token"])
                    wallet_conn.refresh_token_encrypted = token_crypto.encrypt(new_tokens.get("refresh_token", refresh_token))
                    wallet_conn.token_expires_at = datetime.utcnow() + timedelta(seconds=new_tokens.get("expires_in", 21600))
                    wallet_conn.status = "active"
                    token = new_tokens["access_token"]
                    db.commit()
                    print(f"INFO: Token renovado automáticamente para cuenta {id}")
                except Exception as e:
                    print(f"WARNING: Error al renovar token: {e}")
                    wallet_conn.status = "expired"
                    db.commit()
    
    user = db.query(User).filter(User.id == user_id).first()
    user_email = user.email if user else ""
    
    try:
        provider_name = wallet_conn.provider if wallet_conn else "mercadopago"
        adapter = get_adapter(provider_name)
        if not adapter:
            raise Exception(f"Adaptador {provider_name} no disponible")
        
        if wallet_conn and wallet_conn.last_sync_at:
            since_date = wallet_conn.last_sync_at.strftime("%Y-%m-%d")
        else:
            since_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        normalized_txs = adapter.fetch_transactions(
            access_token=token,
            since_date=since_date,
            user_email=user_email,
            provider_user_id=wallet_conn.provider_user_id if wallet_conn else ""
        )
    except Exception as e:
        error_msg = str(e)
        if wallet_conn:
            sync_duration = int((_time.time() - sync_start) * 1000)
            log_entry = SyncLog(
                wallet_connection_id=wallet_conn.id,
                user_id=user_id,
                provider="mercadopago",
                status="error",
                error_message=error_msg[:500],
                duration_ms=sync_duration,
            )
            db.add(log_entry)
            wallet_conn.last_sync_status = "error"
            wallet_conn.last_sync_error = error_msg[:500]
            db.commit()
        
        if "TOKEN_EXPIRED" in error_msg:
            return JSONResponse(status_code=401, content={"error": "El token expiró. Reconectá tu billetera."})
        return JSONResponse(status_code=502, content={"error": f"Error al sincronizar con {provider_name}: {error_msg}"})

    imported_count = 0
    skipped_count = 0
    
    for ntx in normalized_txs:
        existing = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.account_id == id,
            Transaction.amount == ntx.amount,
            Transaction.date == ntx.date,
            Transaction.desc == ntx.description
        ).first()
        
        if existing:
            skipped_count += 1
            continue
            
        new_tx = Transaction(
            user_id=user_id,
            account_id=id,
            type=ntx.type,
            desc=ntx.description,
            amount=ntx.amount,
            cat=ntx.category_hint,
            date=ntx.date
        )
        db.add(new_tx)
        imported_count += 1
    
    balance_updated = False
    try:
        balance_info = adapter.fetch_balance(access_token=token)
        if balance_info and "available_balance" in balance_info:
            acc.balance = balance_info["available_balance"]
            balance_updated = True
    except Exception as balance_err:
        print(f"⚠️ No se pudo obtener saldo de MP vía API: {balance_err}")
    
    if not balance_updated and imported_count > 0:
        is_first_sync = True
        if wallet_conn and wallet_conn.last_sync_at:
            is_first_sync = False
            
        if not is_first_sync:
            for ntx in normalized_txs:
                existing = db.query(Transaction).filter(
                    Transaction.user_id == user_id,
                    Transaction.account_id == id,
                    Transaction.amount == ntx.amount,
                    Transaction.date == ntx.date,
                    Transaction.desc == ntx.description
                ).count()
                if existing > 1:
                    continue
                if ntx.type == "income":
                    acc.balance += ntx.amount
                else:
                    acc.balance -= ntx.amount
    
    sync_duration = int((_time.time() - sync_start) * 1000)
    if wallet_conn:
        wallet_conn.last_sync_at = datetime.utcnow()
        wallet_conn.last_sync_status = "success"
        wallet_conn.last_sync_error = None
        
        log_entry = SyncLog(
            wallet_connection_id=wallet_conn.id,
            user_id=user_id,
            provider="mercadopago",
            status="success",
            transactions_imported=imported_count,
            transactions_skipped=skipped_count,
            duration_ms=sync_duration,
        )
        db.add(log_entry)
    
    db.commit()
    return {"ok": True, "imported_count": imported_count, "skipped_count": skipped_count, "balance": acc.balance}
