"""
Adaptador de Plaid — Stub preparado para implementación futura
===============================================================
Plaid es el estándar para agregación de datos financieros en
EE.UU., Canadá, Reino Unido y Europa (11.000+ bancos).

NOTA: Este adaptador es un STUB. No está implementado porque
Plaid requiere un plan pago para acceso a producción.
El Sandbox (gratuito) permite probar con datos ficticios.

Cuando se tenga financiamiento, implementar los endpoints:
    - POST /link/token/create  → Iniciar Plaid Link
    - POST /item/public_token/exchange → Obtener access_token
    - POST /transactions/get   → Obtener transacciones
    - POST /item/remove        → Desconectar cuenta

Documentación: https://plaid.com/docs/
Pricing: Free Sandbox, $100+/mes para Production
"""

from typing import List, Optional
from .base_adapter import BaseWalletAdapter, NormalizedTransaction


class PlaidAdapter(BaseWalletAdapter):
    """
    Stub de Plaid para implementación futura.
    
    NO registrado en el ADAPTER_REGISTRY porque aún no está funcional.
    Para activarlo, agregar el decorador @register_adapter cuando esté listo.
    """

    @property
    def provider_name(self) -> str:
        return "plaid"

    @property
    def display_name(self) -> str:
        return "Plaid (Bancos EE.UU./Europa)"

    def get_auth_url(self, state: str, redirect_uri: str, code_challenge: Optional[str] = None) -> str:
        raise NotImplementedError(
            "Plaid usa Plaid Link (widget frontend), no una URL de OAuth estándar. "
            "Se necesita implementar el flujo de link_token."
        )

    def exchange_code(self, code: str, redirect_uri: str, code_verifier: Optional[str] = None) -> dict:
        raise NotImplementedError(
            "Implementar POST /item/public_token/exchange para obtener access_token."
        )

    def refresh_access_token(self, refresh_token: str) -> dict:
        raise NotImplementedError(
            "Plaid no usa refresh_token. Los access_tokens no expiran, "
            "pero pueden ser invalidados por el usuario o el banco."
        )

    def fetch_transactions(self, access_token: str, since_date: Optional[str] = None) -> List[NormalizedTransaction]:
        raise NotImplementedError(
            "Implementar POST /transactions/get para obtener transacciones de Plaid."
        )

    def revoke_access(self, access_token: str) -> bool:
        raise NotImplementedError(
            "Implementar POST /item/remove para desconectar la cuenta de Plaid."
        )
