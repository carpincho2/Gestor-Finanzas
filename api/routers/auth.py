import os
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import (
    LoginRequest, RegisterRequest, GoogleRequest, ProfileUpdateRequest, PasswordChangeRequest
)
from security import get_current_user_id
from services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])

def get_auth_service(db: Session = Depends(get_db)):
    return AuthService(db)

@router.get("/me")
async def get_me(request: Request, user_id: int = Depends(get_current_user_id), auth_service: AuthService = Depends(get_auth_service)):
    try:
        user = auth_service.get_me(user_id)
        return {
            "ok": True,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "avatar": user.avatar,
                "picture": user.picture
            }
        }
    except HTTPException as e:
        request.session.clear()
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})

@router.post("/me")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True, "message": "Sesión cerrada"}

@router.delete("/me")
async def delete_me(request: Request, user_id: int = Depends(get_current_user_id), auth_service: AuthService = Depends(get_auth_service)):
    try:
        auth_service.delete_user(user_id)
        request.session.clear()
        return {"ok": True, "message": "Cuenta eliminada correctamente"}
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})

@router.put("/profile")
async def update_profile(payload: ProfileUpdateRequest, user_id: int = Depends(get_current_user_id), auth_service: AuthService = Depends(get_auth_service)):
    try:
        user = auth_service.update_profile(user_id, payload)
        return {
            "ok": True,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "avatar": user.avatar,
                "picture": user.picture
            }
        }
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})

@router.put("/password")
async def change_password(payload: PasswordChangeRequest, user_id: int = Depends(get_current_user_id), auth_service: AuthService = Depends(get_auth_service)):
    try:
        auth_service.change_password(user_id, payload)
        return {"ok": True, "message": "Contraseña actualizada correctamente"}
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})

@router.post("/login")
async def login(request: Request, payload: LoginRequest, auth_service: AuthService = Depends(get_auth_service)):
    client_ip = request.client.host if request.client else "unknown"
    try:
        user, access_token = auth_service.login(payload, client_ip)
        
        request.session["user_id"] = user.id
        request.session["email"] = user.email
        
        return {
            "ok": True,
            "token": access_token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "avatar": user.avatar,
                "picture": user.picture
            }
        }
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})

@router.post("/register", status_code=201)
async def register(request: Request, payload: RegisterRequest, auth_service: AuthService = Depends(get_auth_service)):
    try:
        new_user, access_token = auth_service.register(payload)
        
        request.session["user_id"] = new_user.id
        request.session["email"] = new_user.email
        
        return {
            "ok": True,
            "token": access_token,
            "user": {
                "id": new_user.id,
                "name": new_user.name,
                "email": new_user.email,
                "avatar": new_user.avatar,
                "picture": None
            }
        }
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})

@router.post("/google")
async def google_login(request: Request, payload: GoogleRequest, auth_service: AuthService = Depends(get_auth_service)):
    try:
        # FastAPI's async def handles this fine if we made blocking requests, but in FastAPI it's better to use await asyncio.to_thread 
        # Inside auth_service it does `requests.get` which is blocking. Since `google_login` here is an `async def` route without 
        # await for the service, the service runs in the same thread. Ideally service should be sync and route `def`, or service async.
        # But this matches how it was (except the previous was using asyncio.to_thread).
        # We can just leave `async def` and use the service.
        import asyncio
        user, access_token = await asyncio.to_thread(auth_service.google_login, payload)
        
        request.session["user_id"] = user.id
        request.session["email"] = user.email
        
        return {
            "ok": True,
            "token": access_token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "avatar": user.avatar,
                "picture": user.picture
            }
        }
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})
