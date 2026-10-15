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
        extractor_registry: Optional[ProductExtractorRegistry] = None,
        price_repo: Optional[Any] = None
    ):
        self.wallet_repo = wallet_repo
        self.account_repo = account_repo
        self.extractor_registry = extractor_registry or ProductExtractorRegistry()
        self.price_repo = price_repo

    def _get_user_mp_token(self, user_id: Optional[int]) -> Optional[str]:
        """Obtiene y desencripta el token OAuth de Mercado Pago del usuario si existe."""
        wallet = None
        if user_id:
            wallet = self.wallet_repo.get_active_by_provider(user_id, "mercadopago")
        if not wallet:
            wallet = self.wallet_repo.get_any_active_by_provider("mercadopago")

        if wallet and wallet.access_token_encrypted:
            try:
                from security import token_crypto
                return token_crypto.decrypt(wallet.access_token_encrypted)
            except Exception:
                return None
        return None

    def search_items(self, q: str, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Busca productos en catálogo de e-commerce por palabra clave con fallback multi-fuente."""
        query_str = q.strip()
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json"
        }
        token = self._get_user_mp_token(user_id)
        if token:
            headers["Authorization"] = f"Bearer {token}"

        results = []
        try:
            url = f"https://api.mercadolibre.com/sites/MLA/search?q={requests.utils.quote(query_str)}&limit=5"
            resp = requests.get(url, headers=headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("results", []):
                    results.append({
                        "id": item.get("id"),
                        "title": item.get("title"),
                        "price": float(item.get("price") or 0.0),
                        "currency_id": item.get("currency_id") or "ARS",
                        "thumbnail": item.get("thumbnail"),
                        "permalink": item.get("permalink")
                    })
        except Exception:
            pass

        # Fallback resiliente a catálogo local SEPA si no hubo resultados de ML
        if not results and self.price_repo:
            try:
                sepa_items = self.price_repo.search_products_with_prices(
                    query=query_str,
                    lat=-34.6037,
                    lng=-58.3816,
                    radio_km=30.0,
                    limite_productos=5
                )
                for prod in sepa_items:
                    results.append({
                        "id": prod.ean,
                        "title": prod.nombre,
                        "price": float(prod.mejor_precio or prod.precio_promedio or 0.0),
                        "currency_id": "ARS",
                        "thumbnail": None,
                        "permalink": f"https://supermercados.sepa.gob.ar/p/{prod.ean}"
                    })
            except Exception:
                pass

        return {"ok": True, "results": results}

    def fetch_product_details(self, raw_url: str, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Extrae el precio, título, moneda y metadatos de cualquier tienda web.
        Si la URL pertenece a Mercado Libre y el usuario vinculó Mercado Pago, aprovecha su token OAuth.
        """
        url = raw_url.strip()
        user_token = self._get_user_mp_token(user_id)

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

        details = self.fetch_product_details(url, user_id)
        
        item_id = details.get("item_id")
        title = details.get("title") or "Producto seleccionado"
        currency_id = details.get("currency_id") or "ARS"
        domain = details.get("domain") or "Tienda Web"

        raw_price = payload.price or details.get("price") or 0.0
        if 0 < raw_price < 1000 and round(raw_price * 1000, 2) >= 1000 and round(raw_price * 1000, 3) == float(f"{raw_price * 1000:.3f}"):
            price = float(round(raw_price * 1000, 2))
        else:
            price = raw_price

        if price <= 0:
            raise HTTPException(
                status_code=422,
                detail=f"Identificamos '{title}' en {domain}, pero la tienda requiere ingresar el precio en el campo 'Precio del producto' para calcular las cuotas vs inflación."
            )

        accounts = self.account_repo.get_by_user_id(user_id)
        
        options = evaluate_payment_options(
            price=price,
            accounts=accounts,
            tna=payload.custom_tna,
            discount=payload.discount_percentage,
            installments=payload.installments_without_interest,
            surcharge_percentage=getattr(payload, "surcharge_percentage", 0.0) or 0.0,
            installment_total_price=getattr(payload, "installment_total_price", None),
            max_discount_amount=getattr(payload, "max_discount_amount", None)
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
        barcode_clean = payload.barcode.strip()
        token = self._get_user_mp_token(user_id)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        price = 0.0
        title = ""
        item_id = barcode_clean
        source = "barcode_scan"

        # 1. Intentar Mercado Libre
        try:
            search_resp = requests.get(f"https://api.mercadolibre.com/sites/MLA/search?gtin={barcode_clean}&limit=1", headers=headers, timeout=5)
            if search_resp.status_code == 200:
                search_data = search_resp.json()
                results = search_data.get("results", [])
                if results:
                    item_data = results[0]
                    price = float(item_data.get("price") or 0.0)
                    title = item_data.get("title") or ""
                    item_id = item_data.get("id") or barcode_clean
        except Exception:
            pass

        # 2. Fallback a catálogo local SEPA si ML no lo encontró
        if (price <= 0 or not title) and self.price_repo:
            try:
                comp = self.price_repo.compare_single_product(
                    ean=barcode_clean,
                    query=None,
                    lat=-34.6037,
                    lng=-58.3816,
                    radio_km=30.0
                )
                if comp and comp.producto:
                    title = comp.producto.nombre
                    price = float(comp.producto.mejor_precio or comp.producto.precio_promedio or 0.0)
                    source = "sepa_barcode_catalog"
            except Exception:
                pass

        if price <= 0 and not title:
            raise HTTPException(status_code=404, detail=f"No se encontraron publicaciones activas para el código {barcode_clean}")
            
        accounts = self.account_repo.get_by_user_id(user_id)
        
        options = evaluate_payment_options(
            price=price,
            accounts=accounts,
            tna=payload.custom_tna,
            discount=payload.discount_percentage,
            installments=payload.installments_without_interest,
            surcharge_percentage=getattr(payload, "surcharge_percentage", 0.0) or 0.0,
            installment_total_price=getattr(payload, "installment_total_price", None),
            max_discount_amount=getattr(payload, "max_discount_amount", None)
        )
        
        return {
            "ok": True,
            "item": {
                "id": item_id,
                "title": title or f"Producto EAN {barcode_clean}",
                "price": price,
                "domain": "mercadolibre.com.ar" if source != "sepa_barcode_catalog" else "sepa.gob.ar",
                "source": source
            },
            "recommendation": options
        }

