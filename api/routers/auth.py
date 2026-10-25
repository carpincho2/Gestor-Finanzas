import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from schemas import (
    GoogleRequest,
    LoginRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    RegisterRequest,
)
from security import get_current_user_id
from services.auth_service import AuthService

logger = logging.getLogger("flujo.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_auth_service(db: Session = Depends(get_db)):
    return AuthService(db)


def _serialize_user(user) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "avatar": user.avatar,
        "picture": getattr(user, "picture", None),
    }


@router.get("/me")
async def get_me(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        user = auth_service.get_me(user_id)
        return {"ok": True, "user": _serialize_user(user)}
    except HTTPException as exc:
        request.session.clear()
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    except Exception as exc:
        logger.error("Error en GET /api/auth/me: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Error interno al obtener sesión: {exc}"},
        )


@router.post("/me")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True, "message": "Sesión cerrada"}


@router.delete("/me")
async def delete_me(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        auth_service.delete_user(user_id)
        request.session.clear()
        return {"ok": True, "message": "Cuenta eliminada correctamente"}
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    except Exception as exc:
        logger.error("Error en DELETE /api/auth/me: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Error interno al eliminar cuenta: {exc}"},
        )


@router.put("/profile")
async def update_profile(
    payload: ProfileUpdateRequest,
    user_id: int = Depends(get_current_user_id),
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        user = auth_service.update_profile(user_id, payload)
        return {"ok": True, "user": _serialize_user(user)}
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    except Exception as exc:
        logger.error("Error en PUT /api/auth/profile: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Error interno al actualizar perfil: {exc}"},
        )


@router.put("/password")
async def change_password(
    payload: PasswordChangeRequest,
    user_id: int = Depends(get_current_user_id),
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        auth_service.change_password(user_id, payload)
        return {"ok": True, "message": "Contraseña actualizada correctamente"}
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    except Exception as exc:
        logger.error("Error en PUT /api/auth/password: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Error interno al actualizar contraseña: {exc}"},
        )


@router.post("/login")
async def login(
    request: Request,
    payload: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    client_ip = request.client.host if request.client else "unknown"
    try:
        user, access_token = auth_service.login(payload, client_ip)
        request.session["user_id"] = user.id
        request.session["email"] = user.email
        return {
            "ok": True,
            "token": access_token,
            "user": _serialize_user(user),
        }
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    except Exception as exc:
        logger.error("Error en POST /api/auth/login: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Error interno en inicio de sesión: {exc}"},
        )


@router.post("/register", status_code=201)
async def register(
    request: Request,
    payload: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        new_user, access_token = auth_service.register(payload)
        request.session["user_id"] = new_user.id
        request.session["email"] = new_user.email
        return {
            "ok": True,
            "token": access_token,
            "user": _serialize_user(new_user),
        }
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    except Exception as exc:
        logger.error("Error en POST /api/auth/register: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Error interno en registro de usuario: {exc}"},
        )


@router.post("/google")
async def google_login(
    request: Request,
    payload: GoogleRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        user, access_token = await asyncio.to_thread(auth_service.google_login, payload)
        request.session["user_id"] = user.id
        request.session["email"] = user.email
        return {
            "ok": True,
            "token": access_token,
            "user": _serialize_user(user),
        }
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    except Exception as exc:
        logger.error("Error en POST /api/auth/google: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Error interno en autenticación con Google: {exc}"},
        )
