"""
Adaptador de Mercado Pago — Implementación completa
====================================================
Este adaptador implementa toda la lógica de conexión OAuth 2.0,
sincronización de transacciones y categorización heurística
para la API de Mercado Pago.

Endpoints de MP utilizados:
    - POST /oauth/token          → Intercambiar code por tokens
    - GET  /v1/payments/search   → Obtener pagos del usuario
    - POST /oauth/token (refresh)→ Renovar access_token
"""

import os
import hashlib
import secrets
import requests
from typing import List, Optional
from datetime import datetime

from .base_adapter import (
    BaseWalletAdapter,
    NormalizedTransaction,
    register_adapter,
)


# Categorías heurísticas para transacciones de Mercado Pago
# Se analizan las descripciones de los pagos para asignar una categoría local
MP_CATEGORY_RULES = [
    # (lista de keywords, categoría asignada)
    (
        ["starbucks", "cafe", "burger", "mcdonald", "mostaza", "pizza",
         "restauran", "bar ", "cerveza", "sushi", "parrilla", "helad"],
        "Salidas / Restaurantes"
    ),
    (
        ["coto", "carrefour", "dia%", "jumbo", "disco", "vea", "changomas",
         "supermercado", "almacen", "almacén", "verduleria", "verdulería",
         "chango", "makro"],
        "Supermercado / Almacén"
    ),
    (
        ["ypf", "shell", "axion", "puma energy", "sube", "uber", "cabify",
         "didi", "beat", "nafta", "combustible", "peaje", "transporte",
         "ecobici", "subte", "tren"],
        "Transporte"
    ),
    (
        ["netflix", "spotify", "steam", "disney", "prime", "hbo", "max",
         "playstation", "xbox", "nintendo", "cine", "teatro", "twitch",
         "youtube", "crunchyroll"],
        "Entretenimiento / Suscripciones"
    ),
    (
        ["farmacia", "drogueria", "droguería", "dr. ahorro", "farmacity",
         "salud", "clinica", "clínica", "optica", "óptica", "osde",
         "swiss medical", "galeno"],
        "Salud / Farmacia"
    ),
    (
        ["ropa", "zara", "h&m", "shopping", "vestimenta", "calzado",
         "nike", "adidas", "falabella", "rapsodia", "kosiuko"],
        "Compras / Ropa"
    ),
    (
        ["sueldo", "honorario", "freelance", "ingreso", "cobro",
         "haberes", "salario", "comision", "comisión"],
        "Ingresos (Sueldo/Freelance)"
    ),
    (
        ["luz", "agua", "gas natural", "expensas", "alquiler", "internet",
         "fibertel", "telecentro", "personal", "claro", "movistar",
         "edenor", "edesur", "aysa", "metrogas"],
        "Hogar / Servicios"
    ),
    (
        ["universidad", "colegio", "curso", "libro", "educacion",
         "educación", "udemy", "coursera", "platzi"],
        "Educación"
    ),
    (
        ["plazo fijo", "inversion", "inversión", "fci", "cedear",
         "mercadofondo", "ahorro"],
        "Ahorro / Inversiones"
    ),
]


def _categorize_description(description: str) -> str:
    """
    Asigna una categoría local analizando la descripción del pago.
    
    La heurística funciona buscando palabras clave en el texto.
    Si ninguna coincide, se asigna la categoría 'Otros'.
    """
    desc_lower = description.lower()
    for keywords, category in MP_CATEGORY_RULES:
        if any(kw in desc_lower for kw in keywords):
            return category
    return "Otros"


# Datos simulados para pruebas locales (modo mock)
def _generate_mock_payments(user_email: str) -> list:
    """Genera pagos ficticios realistas para probar sin credenciales."""
    return [
        {
            "id": 1000001,
            "transaction_amount": 4500.00,
            "currency_id": "ARS",
            "description": "Starbucks Coffee",
            "date_approved": "2026-06-25T14:30:00.000Z",
            "payer": {"email": user_email},
            "payment_method_id": "debit_card",
        },
        {
            "id": 1000002,
            "transaction_amount": 18500.00,
            "currency_id": "ARS",
            "description": "Supermercado Coto Suc. 23",
            "date_approved": "2026-06-24T18:15:00.000Z",
            "payer": {"email": user_email},
            "payment_method_id": "debit_card",
        },
        {
            "id": 1000003,
            "transaction_amount": 8000.00,
            "currency_id": "ARS",
            "description": "YPF Combustibles",
            "date_approved": "2026-06-23T08:45:00.000Z",
            "payer": {"email": user_email},
            "payment_method_id": "credit_card",
        },
        {
            "id": 1000004,
            "transaction_amount": 45000.00,
            "currency_id": "ARS",
            "description": "Transferencia Recibida - Freelance",
            "date_approved": "2026-06-22T10:30:00.000Z",
            "payer": {"email": "otra_persona@example.com"},
            "payment_method_id": "account_money",
        },
    ]

def _generate_mock_balance() -> dict:
    """Genera un saldo ficticio para pruebas locales sin credenciales."""
    return {
        "available_balance": 67500.00,
        "unavailable_balance": 0.0,
        "total_balance": 67500.00,
        "currency": "ARS",
    }


@register_adapter
class MercadoPagoAdapter(BaseWalletAdapter):
    """
    Adaptador completo para Mercado Pago.
    
    Soporta:
        - OAuth 2.0 con PKCE para conexión segura
        - Sincronización de transacciones (pagos)
        - Refresco automático de tokens
        - Modo mock para desarrollo local
        - Categorización heurística de gastos argentinos
    """

    MP_BASE_URL = "https://api.mercadopago.com"
    MP_AUTH_URL = "https://auth.mercadopago.com/authorization"

    @property
    def provider_name(self) -> str:
        return "mercadopago"

    @property
    def display_name(self) -> str:
        return "Mercado Pago"

    def get_auth_url(self, state: str, redirect_uri: str, code_challenge: Optional[str] = None) -> str:
        """
        Genera la URL de autorización de Mercado Pago.
        
        El usuario es redirigido a esta URL donde inicia sesión en su cuenta
        de MP y autoriza a Flujo a leer sus transacciones.
        
        Parámetros de la URL:
            response_type=code  → Flujo OAuth Authorization Code
            client_id           → ID de la app registrada en MP Developers
            redirect_uri        → URL de nuestro backend donde MP envía el código
            state               → Token anti-CSRF que verificamos en el callback
            code_challenge      → PKCE challenge para seguridad adicional
        """
        client_id = os.getenv("MP_CLIENT_ID", "")
        
        params = (
            f"?response_type=code"
            f"&client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&state={state}"
        )

        if code_challenge:
            params += f"&code_challenge={code_challenge}&code_challenge_method=S256"

        return f"{self.MP_AUTH_URL}{params}"

    def exchange_code(self, code: str, redirect_uri: str, code_verifier: Optional[str] = None) -> dict:
        """
        Intercambia el código de autorización por tokens de acceso.
        
        Mercado Pago responde con:
            - access_token:  Token para llamar a la API en nombre del usuario
            - refresh_token: Token para renovar el access_token cuando expire
            - expires_in:    Segundos hasta que el access_token expire
            - user_id:       ID del usuario en Mercado Pago
        """
        client_id = os.getenv("MP_CLIENT_ID", "")
        client_secret = os.getenv("MP_CLIENT_SECRET", "")

        payload = {
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }

        if code_verifier:
            payload["code_verifier"] = code_verifier

        response = requests.post(
            f"{self.MP_BASE_URL}/oauth/token",
            json=payload,
            timeout=15,
        )

        if response.status_code != 200:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            raise Exception(
                f"Error al obtener token de MP: {error_data.get('message', response.status_code)}"
            )

        data = response.json()
        return {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", ""),
            "expires_in": data.get("expires_in", 21600),  # 6 horas por defecto
            "provider_user_id": str(data.get("user_id", "")),
        }

    def refresh_access_token(self, refresh_token: str) -> dict:
        """
        Renueva el access_token usando el refresh_token.
        
        Este método se llama automáticamente antes de cada sincronización
        si el token está a punto de expirar (menos de 10 minutos restantes).
        """
        client_id = os.getenv("MP_CLIENT_ID", "")
        client_secret = os.getenv("MP_CLIENT_SECRET", "")

        response = requests.post(
            f"{self.MP_BASE_URL}/oauth/token",
            json={
                "grant_type": "refresh_token",
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
            },
            timeout=15,
        )

        if response.status_code != 200:
            raise Exception("Error al renovar el token de Mercado Pago")

        data = response.json()
        return {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", refresh_token),
            "expires_in": data.get("expires_in", 21600),
        }

    def _get_client_credentials_token(self) -> Optional[str]:
        """Obtiene un token usando client_credentials para la cuenta dueña de la app (fallback)."""
        import os
        client_id = os.getenv("MP_CLIENT_ID")
        client_secret = os.getenv("MP_CLIENT_SECRET")
        if not client_id or not client_secret:
            return None
        
        try:
            response = requests.post(
                f"{self.MP_BASE_URL}/oauth/token",
                json={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "client_credentials"
                },
                timeout=10
            )
            if response.status_code == 200:
                return response.json().get("access_token")
        except Exception as e:
            print(f"⚠️ Error obteniendo client_credentials: {e}")
        return None

    def fetch_transactions(
        self,
        access_token: str,
        since_date: Optional[str] = None,
        user_email: str = "",
    ) -> List[NormalizedTransaction]:
        """
        Obtiene transacciones de Mercado Pago y las normaliza.
        
        En modo mock (access_token es 'mock-token', 'test-token' o 'pruebas'),
        devuelve datos ficticios para pruebas locales sin credenciales reales.
        
        En modo real, llama a GET /v1/payments/search con los filtros:
            - sort=date_created, criteria=desc (más recientes primero)
            - status=approved (solo pagos exitosos)
            - limit=50 (últimos 50 pagos)
        """
        # Modo mock para desarrollo local
        if access_token.lower() in ["mock-token", "test-token", "pruebas"]:
            raw_payments = _generate_mock_payments(user_email)
        else:
            # Llamada real a la API de Mercado Pago
            url = (
                f"{self.MP_BASE_URL}/v1/payments/search"
                f"?sort=date_created&criteria=desc&status=approved&limit=50"
            )
            if since_date:
                url += f"&begin_date={since_date}T00:00:00Z"

            headers = {"Authorization": f"Bearer {access_token}"}
            response = requests.get(url, headers=headers, timeout=15)

            # Fallback a client_credentials si da 403 (falta de permisos en el token OAuth)
            if response.status_code in (401, 403):
                fallback_token = self._get_client_credentials_token()
                if fallback_token and fallback_token != access_token:
                    print(f"⚠️ Recibido {response.status_code} en MP. Reintentando con client_credentials...")
                    headers["Authorization"] = f"Bearer {fallback_token}"
                    response = requests.get(url, headers=headers, timeout=15)

            if response.status_code == 401:
                raise Exception("TOKEN_EXPIRED")
            if response.status_code != 200:
                err = response.json() if "application/json" in response.headers.get("content-type", "") else {}
                raise Exception(f"Error de MP: {response.status_code} - {err.get('message', '')}")

            raw_payments = response.json().get("results", [])

        # Normalizar cada pago al formato común
        normalized = []
        for payment in raw_payments:
            desc = (payment.get("description") or "Pago Mercado Pago").strip()
            amount = float(payment.get("transaction_amount") or 0.0)
            currency = payment.get("currency_id", "ARS")
            date_str = payment.get("date_approved") or datetime.utcnow().isoformat()
            date = date_str[:10]  # YYYY-MM-DD

            # Determinar tipo: por defecto los pagos en este endpoint suelen ser cobros (ingresos)
            payer_email = payment.get("payer", {}).get("email", "")
            tx_type = "income"
            # Si el pagador está identificado y coincide exactamente con el email del usuario, es un gasto
            if payer_email and user_email and payer_email.lower() == user_email.lower():
                tx_type = "expense"

            # Categorización heurística
            category = _categorize_description(desc)
            # Si es ingreso y la categoría es genérica, asignar categoría de ingreso
            if tx_type == "income" and category == "Otros":
                category = "Ingresos (Sueldo/Freelance)"

            normalized.append(NormalizedTransaction(
                external_id=f"mp-{payment.get('id', '')}",
                provider="mercadopago",
                description=desc,
                amount=amount,
                currency=currency,
                date=date,
                type=tx_type,
                category_hint=category,
                merchant_name=desc,
                payment_method=payment.get("payment_method_id"),
            ))

        return normalized

    def fetch_balance(self, access_token: str) -> dict:
        """
        Obtiene el saldo real de la cuenta de Mercado Pago del usuario.

        Llama a GET /v1/users/me que incluye la información de la cuenta
        con available_balance (saldo disponible para operar).

        En modo mock devuelve un saldo ficticio para pruebas.

        Returns:
            dict con: available_balance, total_balance, currency
        """
        # Modo mock para desarrollo local
        if access_token.lower() in ["mock-token", "test-token", "pruebas"]:
            return _generate_mock_balance()

        # Llamada real a la API de Mercado Pago
        headers = {"Authorization": f"Bearer {access_token}"}
        fallback_token = None

        # 1. Intentar obtener balance del endpoint oficial de la cuenta
        try:
            balance_resp = requests.get(
                f"{self.MP_BASE_URL}/v1/account/balance",
                headers=headers,
                timeout=10,
            )
            if balance_resp.status_code in (401, 403):
                 fallback_token = self._get_client_credentials_token()
                 if fallback_token and fallback_token != access_token:
                     headers["Authorization"] = f"Bearer {fallback_token}"
                     balance_resp = requests.get(
                        f"{self.MP_BASE_URL}/v1/account/balance",
                        headers=headers,
                        timeout=10,
                     )
            
            if balance_resp.status_code == 401:
                raise Exception("TOKEN_EXPIRED")
                
            if balance_resp.status_code == 200:
                balance_data = balance_resp.json()
                available = balance_data.get("available_balance", 0.0)
                total = balance_data.get("total_amount", available)
                currency = balance_data.get("currency_id", "ARS")
                return {
                    "available_balance": float(available),
                    "total_balance": float(total),
                    "currency": currency,
                }
        except Exception as e:
            if str(e) == "TOKEN_EXPIRED":
                raise
            print(f"⚠️ Error al obtener balance de /v1/account/balance: {e}")

        # 2. Fallback: intentar con /v1/users/me
        try:
            me_resp = requests.get(
                f"{self.MP_BASE_URL}/v1/users/me",
                headers=headers,
                timeout=15,
            )
            if me_resp.status_code == 200:
                data = me_resp.json()
                mp_account = data.get("tags", {}).get("mercadopago_account", {})
                if isinstance(mp_account, dict) and "available_balance" in mp_account:
                    return {
                        "available_balance": float(mp_account["available_balance"]),
                        "total_balance": float(mp_account.get("balance", mp_account["available_balance"])),
                        "currency": "ARS",
                    }
        except Exception:
            pass

        if available is not None:
            return {
                "available_balance": float(available),
                "total_balance": float(available),
                "currency": data.get("site_id", "ARS")[-3:] if data.get("site_id") else "ARS",
            }

        return None

    def revoke_access(self, access_token: str) -> bool:
        """
        Mercado Pago no tiene un endpoint estándar de revocación OAuth.
        Eliminamos los tokens de nuestra base de datos, lo que efectivamente
        impide que la app acceda a la cuenta del usuario.
        """
        # La revocación se maneja eliminando los tokens cifrados de la BD.
        # No se necesita llamar a ningún endpoint de MP.
        return True


# ============================================================
#  UTILIDADES PKCE (Proof Key for Code Exchange)
# ============================================================

def generate_pkce_pair() -> tuple[str, str]:
    """
    Genera un par (code_verifier, code_challenge) para PKCE.
    
    PKCE es una extensión de seguridad de OAuth 2.0 que protege
    contra ataques de interceptación del código de autorización.
    
    - code_verifier: String aleatorio de 128 caracteres
    - code_challenge: SHA256(code_verifier) codificado en base64url
    
    El verifier se guarda en la sesión del usuario y se envía al
    intercambiar el código. MP verifica que SHA256(verifier) == challenge.
    """
    import base64

    # Generar un verifier aleatorio de 128 bytes, codificado en URL-safe base64
    verifier = secrets.token_urlsafe(96)  # ~128 caracteres

    # Calcular el challenge como SHA256 del verifier en base64url (sin padding)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

    return verifier, challenge
