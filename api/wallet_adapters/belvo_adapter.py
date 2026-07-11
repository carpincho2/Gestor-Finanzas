"""
Adaptador de Belvo — Stub preparado para implementación futura
===============================================================
Belvo es la plataforma de Open Finance líder en Latinoamérica,
con cobertura principal en México, Brasil y Colombia.

NOTA: Este adaptador es un STUB. No está implementado porque:
    1. Belvo NO tiene cobertura directa en Argentina (a junio 2026).
    2. El plan de producción comienza en ~$1,000 USD/mes.
    3. El Sandbox (gratuito) permite probar con datos ficticios.

Cuando se tenga financiamiento y cobertura en Argentina:
    - POST /api/links/          → Crear link con banco del usuario
    - GET  /api/transactions/   → Obtener transacciones
    - DELETE /api/links/{id}/   → Desconectar cuenta

Documentación: https://developers.belvo.com/
Bancos soportados: Bancolombia, BBVA Bancomer, Nequi, Nubank, etc.
"""

from typing import List, Optional
from .base_adapter import BaseWalletAdapter, NormalizedTransaction


class BelvoAdapter(BaseWalletAdapter):
    """
    Stub de Belvo para implementación futura.
    
    NO registrado en el ADAPTER_REGISTRY porque aún no tiene
    cobertura en Argentina y requiere plan pago.
    """

    @property
    def provider_name(self) -> str:
        return "belvo"

    @property
    def display_name(self) -> str:
        return "Belvo (México/Colombia/Brasil)"

    def get_auth_url(self, state: str, redirect_uri: str, code_challenge: Optional[str] = None) -> str:
        # Simulate OAuth redirect flow for our Router demo.
        return f"/api/wallets/belvo/callback?state={state}&code=mock-belvo-auth-code"

    def exchange_code(self, code: str, redirect_uri: str, code_verifier: Optional[str] = None) -> dict:
        return {
            "access_token": "mock-belvo-access-token-67890",
            "refresh_token": "mock-belvo-refresh-token",
            "expires_in": 31536000,
            "provider_user_id": "belvo-user-404"
        }

    def refresh_access_token(self, refresh_token: str) -> dict:
        return {
            "access_token": "mock-belvo-access-token-67890",
            "refresh_token": "mock-belvo-refresh-token",
            "expires_in": 31536000
        }

    def fetch_transactions(self, access_token: str, since_date: Optional[str] = None, **kwargs) -> List[NormalizedTransaction]:
        # Return mock transactions from Belvo (e.g. Nubank, Rappi)
        from datetime import datetime, timedelta
        import random
        
        today = datetime.utcnow()
        
        return [
            NormalizedTransaction(
                external_id=f"belvo-tx-{random.randint(1000, 9999)}",
                provider=self.provider_name,
                description="Rappi Supermercado",
                amount=25000.00,
                currency="COP",
                date=today.strftime("%Y-%m-%d"),
                type="expense",
                category_hint="Alimentación",
                merchant_name="Rappi"
            ),
            NormalizedTransaction(
                external_id=f"belvo-tx-{random.randint(1000, 9999)}",
                provider=self.provider_name,
                description="Nubank Transferencia",
                amount=150.00,
                currency="BRL",
                date=today.strftime("%Y-%m-%d"),
                type="income",
                category_hint="Transferencia",
                merchant_name="Nubank"
            )
        ]

    def revoke_access(self, access_token: str) -> bool:
        return True

from .base_adapter import register_adapter
register_adapter(BelvoAdapter)
