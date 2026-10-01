import requests
from fastapi import HTTPException
from typing import Dict, Any, Optional

from ports.repositories.wallet_repository_port import IWalletRepository
from ports.repositories.account_repository_port import IAccountRepository
from services.recommendation import evaluate_payment_options
from services.shopping.extractor_registry import ProductExtractorRegistry


class ShoppingService:
    """
    Servicio de Dominio y Aplicación para el Asistente de Compras Inteligente.
    Orquesta la extracción multi-tienda y la evaluación financiera de opciones de pago (VPN / Cuotas / Inflación).
    Cumple con el Principio de Responsabilidad Única (SRP) y Arquitectura Hexagonal/PHAME.
    """

    def __init__(
        self,
        account_repo: IAccountRepository,
        wallet_repo: IWalletRepository,
        extractor_registry: Optional[ProductExtractorRegistry] = None
    ):
        self.wallet_repo = wallet_repo
        self.account_repo = account_repo
        self.extractor_registry = extractor_registry or ProductExtractorRegistry()

    def search_items(self, q: str) -> Dict[str, Any]:
        """Busca productos en catálogo de e-commerce por palabra clave."""
        url = f"https://api.mercadolibre.com/sites/MLA/search?q={q}&limit=5"
        resp = requests.get(url)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Error al consultar el catálogo de productos")
        
        data = resp.json()
        results = []
        for item in data.get("results", []):
            results.append({
                "id": item.get("id"),
                "title": item.get("title"),
                "price": item.get("price"),
                "currency_id": item.get("currency_id"),
                "thumbnail": item.get("thumbnail"),
                "permalink": item.get("permalink")
            })
        return {"ok": True, "results": results}

    def fetch_product_details(self, raw_url: str, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Extrae el precio, título, moneda y metadatos de cualquier tienda web.
        Si la URL pertenece a Mercado Libre y el usuario vinculó Mercado Pago, aprovecha su token OAuth.
        """
        url = raw_url.strip()

        # 1. Recuperar token de Mercado Pago si existe (para integración con ML)
        user_token = None
        wallet = None
        if user_id:
            wallet = self.wallet_repo.get_active_by_provider(user_id, "mercadopago")
        if not wallet:
            wallet = self.wallet_repo.get_any_active_by_provider("mercadopago")

        if wallet and wallet.access_token_encrypted:
            try:
                from security import token_crypto
                user_token = token_crypto.decrypt(wallet.access_token_encrypted)
            except Exception:
                pass

        # 2. Delegar al extractor correspondiente registrado en el Strategy Registry
        extractor = self.extractor_registry.get_extractor(url)
        details = extractor.extract(url, user_id=user_id, user_token=user_token)

        return details

    def analyze_url(self, payload, user_id: int) -> Dict[str, Any]:
        """
        Analiza una URL de cualquier tienda online y recomienda el mejor método financiero de pago
        (VPN, cuotas vs inflación, o pago al contado con descuento).
        """
        url = payload.url.strip()
        if not url:
            raise HTTPException(status_code=400, detail="Debes proporcionar una URL válida del producto.")

        # Extraer o consultar detalles del producto
        details = self.fetch_product_details(url, user_id)
        
        item_id = details.get("item_id")
        title = details.get("title") or "Producto seleccionado"
        currency_id = details.get("currency_id") or "ARS"
        domain = details.get("domain") or "Tienda Web"

        raw_price = payload.price or details.get("price") or 0.0
        # Corregir caso donde el usuario ingresa 194.799 pensando que son 194 mil pesos
        if 0 < raw_price < 1000 and round(raw_price * 1000, 2) >= 1000 and round(raw_price * 1000, 3) == float(f"{raw_price * 1000:.3f}"):
            price = float(round(raw_price * 1000, 2))
        else:
            price = raw_price

        if price <= 0:
            raise HTTPException(
                status_code=422,
                detail=f"Identificamos '{title}' en {domain}, pero la tienda requiere ingresar el precio en el campo 'Precio del producto' para calcular las cuotas vs inflación."
            )

        # Evaluar opciones de pago con las cuentas bancarias y tarjetas del usuario
        accounts = self.account_repo.get_by_user_id(user_id)
        
        options = evaluate_payment_options(
            price=price,
            accounts=accounts,
            tna=payload.custom_tna,
            discount=payload.discount_percentage,
            installments=payload.installments_without_interest,
            surcharge_percentage=getattr(payload, "surcharge_percentage", 0.0) or 0.0,
            installment_total_price=getattr(payload, "installment_total_price", None)
        )
        
        return {
            "ok": True,
            "item": {
                "id": item_id or "WEB_LINK",
                "title": title,
                "price": price,
                "currency": currency_id,
                "domain": domain,
                "source": details.get("source", "generic")
            },
            "recommendation": options
        }

    def analyze_barcode(self, payload, user_id: int) -> Dict[str, Any]:
        """Busca un producto por GTIN/EAN (código de barras) y recomienda el mejor método de pago."""
        search_resp = requests.get(f"https://api.mercadolibre.com/sites/MLA/search?gtin={payload.barcode}&limit=1")
        if search_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Error consultando catálogo por código de barras")
            
        search_data = search_resp.json()
        results = search_data.get("results", [])
        
        if not results:
            raise HTTPException(status_code=404, detail="No se encontraron publicaciones activas para este código de barras")
            
        item_data = results[0]
        price = item_data.get("price", 0.0)
        title = item_data.get("title", "")
        item_id = item_data.get("id", "")
        
        accounts = self.account_repo.get_by_user_id(user_id)
        
        options = evaluate_payment_options(
            price=price,
            accounts=accounts,
            tna=payload.custom_tna,
            discount=payload.discount_percentage,
            installments=payload.installments_without_interest,
            surcharge_percentage=getattr(payload, "surcharge_percentage", 0.0) or 0.0,
            installment_total_price=getattr(payload, "installment_total_price", None)
        )
        
        return {
            "ok": True,
            "item": {
                "id": item_id,
                "title": title,
                "price": price,
                "domain": "mercadolibre.com.ar",
                "source": "barcode_scan"
            },
            "recommendation": options
        }
