"""
Adaptador Base para Billeteras Virtuales (Patrón Adapter / Strategy)
=====================================================================
Este módulo define la interfaz abstracta que todo adaptador de billetera
virtual debe cumplir. El objetivo es que agregar un nuevo proveedor
(Plaid, Belvo, Fintoc, etc.) sea tan simple como crear un archivo nuevo
que herede de BaseWalletAdapter e implemente sus métodos.

Concepto didáctico:
    El patrón Adapter/Strategy permite que el "Financial Router" del
    backend no necesite conocer los detalles internos de cada API externa.
    Solo sabe que todos los adaptadores exponen los mismos métodos con
    las mismas firmas. Esto es lo que se conoce como "programar contra
    una interfaz, no contra una implementación".
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class NormalizedTransaction:
    """
    Estructura común para transacciones importadas de cualquier proveedor.

    Sin importar si la transacción viene de Mercado Pago, Plaid o Belvo,
    al llegar a nuestra base de datos siempre tiene esta forma.
    Esto simplifica enormemente el código del frontend y del backend.
    """
    external_id: str              # ID único del proveedor (ej: "mp-12345")
    provider: str                 # 'mercadopago', 'plaid', 'belvo'
    description: str              # Descripción del pago/movimiento
    amount: float                 # Monto absoluto
    currency: str                 # ISO 4217: ARS, USD, EUR, CLP
    date: str                     # YYYY-MM-DD
    type: str                     # 'income' o 'expense'
    category_hint: str            # Categoría sugerida por el adaptador
    merchant_name: Optional[str] = None      # Nombre del comercio
    payment_method: Optional[str] = None     # 'debit', 'credit', 'transfer'


class BaseWalletAdapter(ABC):
    """
    Contrato abstracto que todo adaptador de billetera virtual debe cumplir.
    
    Métodos requeridos:
        get_auth_url       → Genera la URL de OAuth para que el usuario conecte su cuenta.
        exchange_code      → Intercambia el código de autorización por tokens de acceso.
        refresh_access_token → Renueva un access_token expirado usando el refresh_token.
        fetch_transactions → Obtiene transacciones normalizadas del proveedor.
        revoke_access      → Revoca el acceso OAuth (desconectar billetera).

    Para agregar un nuevo proveedor:
        1. Creá un archivo nuevo en wallet_adapters/ (ej: fintoc_adapter.py)
        2. Heredá de BaseWalletAdapter
        3. Implementá todos los métodos abstractos
        4. Registralo en el ADAPTER_REGISTRY al final de este archivo
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Nombre interno del proveedor (ej: 'mercadopago', 'plaid')."""
        ...

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Nombre visible para el usuario (ej: 'Mercado Pago')."""
        ...

    @abstractmethod
    def get_auth_url(self, state: str, redirect_uri: str, code_challenge: Optional[str] = None) -> str:
        """
        Genera la URL de autorización OAuth 2.0 para el proveedor.
        
        Args:
            state: String aleatorio para prevenir CSRF.
            redirect_uri: URL de callback de nuestro backend.
            code_challenge: Challenge PKCE (SHA256) si el proveedor lo soporta.
        
        Returns:
            URL completa a la que redirigir al usuario.
        """
        ...

    @abstractmethod
    def exchange_code(self, code: str, redirect_uri: str, code_verifier: Optional[str] = None) -> dict:
        """
        Intercambia el código de autorización por tokens de acceso.
        
        Args:
            code: Código temporal recibido en el callback de OAuth.
            redirect_uri: La misma redirect_uri usada en get_auth_url.
            code_verifier: Verifier PKCE si se usó code_challenge.
        
        Returns:
            dict con: access_token, refresh_token (opcional), expires_in (segundos).
        """
        ...

    @abstractmethod
    def refresh_access_token(self, refresh_token: str) -> dict:
        """
        Renueva el access_token usando el refresh_token.
        
        Args:
            refresh_token: Token de refresco guardado.
        
        Returns:
            dict con: access_token, refresh_token (nuevo, opcional), expires_in.
        """
        ...

    @abstractmethod
    def fetch_transactions(self, access_token: str, since_date: Optional[str] = None) -> List[NormalizedTransaction]:
        """
        Obtiene transacciones normalizadas del proveedor.
        
        Args:
            access_token: Token de acceso vigente.
            since_date: Fecha desde la cual traer transacciones (YYYY-MM-DD).
        
        Returns:
            Lista de NormalizedTransaction.
        """
        ...

    @abstractmethod
    def revoke_access(self, access_token: str) -> bool:
        """
        Revoca el acceso OAuth (desconectar billetera).
        
        Args:
            access_token: Token a revocar.
        
        Returns:
            True si se revocó exitosamente.
        """
        ...


# ============================================================
#  REGISTRO DE ADAPTADORES (Adapter Registry)
# ============================================================
# Este diccionario permite al Financial Router encontrar el adaptador
# correcto por nombre. Cada adaptador se registra al importarse.
ADAPTER_REGISTRY: dict[str, type] = {}


def register_adapter(adapter_class: type):
    """Decorador para registrar un adaptador en el registry."""
    instance = adapter_class()
    ADAPTER_REGISTRY[instance.provider_name] = adapter_class
    return adapter_class


def get_adapter(provider_name: str) -> Optional[BaseWalletAdapter]:
    """Obtiene una instancia del adaptador por nombre de proveedor."""
    cls = ADAPTER_REGISTRY.get(provider_name)
    if cls:
        return cls()
    return None
