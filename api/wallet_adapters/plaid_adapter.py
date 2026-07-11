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
        # Plaid normally uses Link (frontend widget), but for our Router demo, 
        # we will simulate an OAuth redirect flow that auto-accepts after 2 seconds.
        return f"/api/wallets/plaid/callback?state={state}&code=mock-plaid-auth-code"

    def exchange_code(self, code: str, redirect_uri: str, code_verifier: Optional[str] = None) -> dict:
        return {
            "access_token": "mock-plaid-access-token-12345",
            "refresh_token": "mock-plaid-refresh-token",
            "expires_in": 31536000, # 1 year
            "provider_user_id": "plaid-user-999"
        }

    def refresh_access_token(self, refresh_token: str) -> dict:
        return {
            "access_token": "mock-plaid-access-token-12345",
            "refresh_token": "mock-plaid-refresh-token",
            "expires_in": 31536000
        }

    def fetch_transactions(self, access_token: str, since_date: Optional[str] = None, **kwargs) -> List[NormalizedTransaction]:
        # Return 2 mock transactions from Plaid (e.g. Chase Bank, Starbucks)
        from datetime import datetime, timedelta
        import random
        
        today = datetime.utcnow()
        yesterday = today - timedelta(days=1)
        
        return [
            NormalizedTransaction(
                external_id=f"plaid-tx-{random.randint(1000, 9999)}",
                provider=self.provider_name,
                description="Starbucks Coffee",
                amount=5.50,
                currency="USD",
                date=today.strftime("%Y-%m-%d"),
                type="expense",
                category_hint="Alimentación",
                merchant_name="Starbucks"
            ),
            NormalizedTransaction(
                external_id=f"plaid-tx-{random.randint(1000, 9999)}",
                provider=self.provider_name,
                description="Chase Bank Payroll",
                amount=1500.00,
                currency="USD",
                date=yesterday.strftime("%Y-%m-%d"),
                type="income",
                category_hint="Salario",
                merchant_name="Chase"
            )
        ]

    def revoke_access(self, access_token: str) -> bool:
        return True

from .base_adapter import register_adapter
register_adapter(PlaidAdapter)
