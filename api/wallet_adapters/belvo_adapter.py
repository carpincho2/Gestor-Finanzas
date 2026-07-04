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
        raise NotImplementedError(
            "Belvo usa un Connect Widget (similar a Plaid Link), no OAuth estándar. "
            "Se necesita implementar el flujo del widget."
        )

    def exchange_code(self, code: str, redirect_uri: str, code_verifier: Optional[str] = None) -> dict:
        raise NotImplementedError(
            "Implementar la creación de links y obtención de credenciales de Belvo."
        )

    def refresh_access_token(self, refresh_token: str) -> dict:
        raise NotImplementedError(
            "Belvo maneja la renovación de credenciales internamente. "
            "Los links pueden requerir re-autenticación periódica."
        )

    def fetch_transactions(self, access_token: str, since_date: Optional[str] = None, **kwargs) -> List[NormalizedTransaction]:
        raise NotImplementedError(
            "Implementar GET /api/transactions/ para obtener transacciones de Belvo."
        )

    def revoke_access(self, access_token: str) -> bool:
        raise NotImplementedError(
            "Implementar DELETE /api/links/{id}/ para desconectar la cuenta de Belvo."
        )
