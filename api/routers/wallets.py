import os
import secrets
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import WalletConnection, Account, SyncLog
from security import get_current_user_id, token_crypto
from wallet_adapters import get_adapter

router = APIRouter(prefix="/api", tags=["wallets"])

@router.get("/wallets/{provider}/connect")
async def wallet_connect(provider: str, request: Request, account_id: int = Query(...)):
    user_id = get_current_user_id(request)
    
    adapter = get_adapter(provider)
    if not adapter:
        return JSONResponse(status_code=400, content={"error": f"Proveedor {provider} no soportado"})
    
    from wallet_adapters.mercadopago_adapter import generate_pkce_pair
    
    code_verifier, code_challenge = generate_pkce_pair()
    state = secrets.token_urlsafe(32)
    
    request.session["oauth_state"] = state
    request.session["oauth_verifier"] = code_verifier
    request.session["oauth_account_id"] = account_id
    request.session["oauth_provider"] = provider
    
    host_url = request.url.components.scheme + "://" + request.url.components.netloc
    redirect_uri = f"{host_url}/api/wallets/{provider}/callback"
    
    auth_url = adapter.get_auth_url(
        state=state,
        redirect_uri=redirect_uri,
        code_challenge=code_challenge,
    )
    
    return RedirectResponse(url=auth_url, status_code=302)

@router.get("/wallets/{provider}/callback")
async def wallet_callback(provider: str, request: Request, code: str = "", state: str = "", error: str = "", db: Session = Depends(get_db)):
    if error:
        return RedirectResponse(url="/main.html#cuentas?wallet_error=access_denied", status_code=302)
    
    saved_state = request.session.get("oauth_state", "")
    if state != saved_state:
        return RedirectResponse(url="/main.html#cuentas?wallet_error=csrf_invalid", status_code=302)
    
    user_id = request.session.get("user_id")
    if not user_id:
        return RedirectResponse(url="/index.html", status_code=302)
    
    account_id = request.session.get("oauth_account_id")
    code_verifier = request.session.get("oauth_verifier", "")
    
    for key in ["oauth_state", "oauth_verifier", "oauth_account_id"]:
        request.session.pop(key, None)
    
    try:
        adapter = get_adapter(provider)
        if not adapter:
            return RedirectResponse(url="/main.html#cuentas?wallet_error=provider_unknown", status_code=302)
        
        host_url = request.url.components.scheme + "://" + request.url.components.netloc
        redirect_uri = f"{host_url}/api/wallets/{provider}/callback"
        
        tokens = adapter.exchange_code(
            code=code,
            redirect_uri=redirect_uri,
            code_verifier=code_verifier,
        )
        
        access_encrypted = token_crypto.encrypt(tokens["access_token"])
        refresh_encrypted = token_crypto.encrypt(tokens.get("refresh_token", ""))
        expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 21600))
        
        wallet_conn = db.query(WalletConnection).filter(
            WalletConnection.account_id == account_id,
            WalletConnection.user_id == user_id,
            WalletConnection.provider == provider
        ).first()
        
        if wallet_conn:
            wallet_conn.access_token_encrypted = access_encrypted
            wallet_conn.refresh_token_encrypted = refresh_encrypted
            wallet_conn.token_expires_at = expires_at
            wallet_conn.provider_user_id = tokens.get("provider_user_id", "")
            wallet_conn.status = "active"
        else:
            wallet_conn = WalletConnection(
                user_id=user_id,
                account_id=account_id,
                provider=provider,
                provider_user_id=tokens.get("provider_user_id", ""),
                access_token_encrypted=access_encrypted,
                refresh_token_encrypted=refresh_encrypted,
                token_expires_at=expires_at,
                status="active",
            )
            db.add(wallet_conn)
        
        acc = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
        if acc:
            acc.mp_token = access_encrypted
        
        db.commit()
        return RedirectResponse(url=f"/main.html?v=1.0.6#cuentas?wallet_connected=1&account_id={account_id}", status_code=302)
        
    except Exception as e:
        print(f"ERROR: Error en OAuth callback de {provider}: {e}")
        return RedirectResponse(url="/main.html#cuentas?wallet_error=exchange_failed", status_code=302)

@router.post("/wallets/{provider}/disconnect/{account_id}")
async def wallet_disconnect(provider: str, account_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == account_id,
        WalletConnection.user_id == user_id,
        WalletConnection.provider == provider
    ).first()
    
    if wallet_conn:
        try:
            adapter = get_adapter(provider)
            if adapter and wallet_conn.access_token_encrypted:
                token = token_crypto.decrypt(wallet_conn.access_token_encrypted)
                adapter.revoke_access(token)
        except Exception as e:
            print(f"Advertencia: No se pudo revocar el token en {provider}: {e}")
            
        wallet_conn.access_token_encrypted = None
        wallet_conn.refresh_token_encrypted = None
        wallet_conn.status = "revoked"
        wallet_conn.token_expires_at = None
    
    if provider == "mercadopago":
        acc = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
        if acc:
            acc.mp_token = None
    
    db.commit()
    return {"ok": True, "message": f"Billetera de {provider} desconectada"}

@router.get("/wallets/status/{account_id}")
async def wallet_status(account_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == account_id,
        WalletConnection.user_id == user_id,
    ).first()
    
    if not wallet_conn:
        acc = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
        has_legacy_token = bool(acc and acc.mp_token)
        return {
            "ok": True,
            "connected": has_legacy_token,
            "provider": "mercadopago" if has_legacy_token else None,
            "status": "active" if has_legacy_token else "disconnected",
            "is_oauth": False,
            "last_sync_at": None,
            "last_sync_status": None,
            "last_sync_error": None,
        }
    
    return {
        "ok": True,
        "connected": wallet_conn.status == "active",
        "provider": wallet_conn.provider,
        "status": wallet_conn.status,
        "is_oauth": bool(wallet_conn.refresh_token_encrypted),
        "last_sync_at": wallet_conn.last_sync_at.isoformat() if wallet_conn.last_sync_at else None,
        "last_sync_status": wallet_conn.last_sync_status,
        "last_sync_error": wallet_conn.last_sync_error,
    }

@router.get("/wallets/{account_id}/sync-history")
async def wallet_sync_history(account_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.account_id == account_id,
        WalletConnection.user_id == user_id,
    ).first()
    
    if not wallet_conn:
        return {"ok": True, "history": []}
    
    logs = db.query(SyncLog).filter(
        SyncLog.wallet_connection_id == wallet_conn.id
    ).order_by(SyncLog.created_at.desc()).limit(10).all()
    
    return {
        "ok": True,
        "history": [
            {
                "id": log.id,
                "status": log.status,
                "imported": log.transactions_imported,
                "skipped": log.transactions_skipped,
                "error": log.error_message,
                "duration_ms": log.duration_ms,
                "date": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
    }

@router.post("/webhooks/mercadopago")
async def mp_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})
    
    mp_secret = os.getenv("MP_WEBHOOK_SECRET", "")
    if not mp_secret:
        return JSONResponse(status_code=500, content={"error": "Webhook secret no configurado en el servidor"})
        
    x_signature = request.headers.get("x-signature", "")
    x_request_id = request.headers.get("x-request-id", "")
    
    if not x_signature:
        return JSONResponse(status_code=401, content={"error": "Missing signature"})
        
    parts = dict(p.split("=", 1) for p in x_signature.split(",") if "=" in p)
    ts = parts.get("ts", "")
    v1 = parts.get("v1", "")
    
    data_id = body.get("data", {}).get("id", "")
    manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
    
    import hmac
    expected = hmac.new(
        mp_secret.encode("utf-8"),
        manifest.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(v1, expected):
        return JSONResponse(status_code=401, content={"error": "Invalid signature"})
    
    action = body.get("action", "")
    data_id = body.get("data", {}).get("id", "")
    user_id_mp = body.get("user_id", "")
    
    if action == "payment.created" and data_id:
        wallet_conn = db.query(WalletConnection).filter(
            WalletConnection.provider == "mercadopago",
            WalletConnection.provider_user_id == str(user_id_mp),
            WalletConnection.status == "active"
        ).first()
        
        if wallet_conn:
            wallet_conn.last_sync_error = f"Webhook recibido: payment {data_id}. Sincronizar para importar."
            db.commit()
    
    return {"ok": True}

@router.get("/debug/mp")
async def debug_mp(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
    wallet_conn = db.query(WalletConnection).filter(
        WalletConnection.user_id == user_id, 
        WalletConnection.provider == "mercadopago"
    ).first()
    
    if not wallet_conn or not wallet_conn.access_token_encrypted:
        return {"error": "No hay cuenta de MercadoPago conectada"}
        
    try:
        access_token = token_crypto.decrypt(wallet_conn.access_token_encrypted)
    except Exception as e:
        return {"error": f"Error desencriptando token: {e}"}
        
    import requests
    headers = {"Authorization": f"Bearer {access_token}"}
    
    fallback_token = None
    client_id = os.getenv("MP_CLIENT_ID")
    client_secret = os.getenv("MP_CLIENT_SECRET")
    if client_id and client_secret:
        try:
            r_fb = requests.post(
                "https://api.mercadopago.com/oauth/token",
                json={"client_id": client_id, "client_secret": client_secret, "grant_type": "client_credentials"},
                timeout=10
            )
            if r_fb.status_code == 200:
                fallback_token = r_fb.json().get("access_token")
        except Exception:
            pass

    me_data = {}
    try:
        me_resp = requests.get("https://api.mercadopago.com/v1/users/me", headers=headers, timeout=5)
        if me_resp.status_code in (401, 403) and fallback_token:
            me_resp = requests.get("https://api.mercadopago.com/v1/users/me", headers={"Authorization": f"Bearer {fallback_token}"}, timeout=5)
        me_data = {"status": me_resp.status_code, "text": me_resp.text}
    except Exception as e:
        me_data = {"error": str(e)}
        
    payments_data = {}
    try:
        url = "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=10"
        pay_resp = requests.get(url, headers=headers, timeout=5)
        if pay_resp.status_code in (401, 403) and fallback_token:
            pay_resp = requests.get(url, headers={"Authorization": f"Bearer {fallback_token}"}, timeout=5)
        payments_data = {"status": pay_resp.status_code, "text": pay_resp.text}
    except Exception as e:
        payments_data = {"error": str(e)}
        
    return {
        "user_id_en_db": wallet_conn.provider_user_id,
        "me_api": me_data,
        "last_10_payments": payments_data
    }
