import requests
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from security import get_current_user_id
from models import Account
from services.recommendation import evaluate_payment_options

router = APIRouter(prefix="/api/shopping", tags=["shopping"])

class AnalyzeUrlRequest(BaseModel):
    url: str
    discount_percentage: Optional[float] = 0.0
    installments_without_interest: Optional[int] = 1
    custom_tna: Optional[float] = 40.0 # Tasa nominal anual (default fallback)

class AnalyzeBarcodeRequest(BaseModel):
    barcode: str
    discount_percentage: Optional[float] = 0.0
    installments_without_interest: Optional[int] = 1
    custom_tna: Optional[float] = 40.0

@router.get("/search")
async def search_items(q: str = Query(...)):
    """Busca productos en Mercado Libre por palabra clave."""
    url = f"https://api.mercadolibre.com/sites/MLA/search?q={q}&limit=5"
    resp = requests.get(url)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Error fetching data from Mercado Libre")
    
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

@router.post("/analyze-url")
async def analyze_url(payload: AnalyzeUrlRequest, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Analiza una URL de ML y recomienda el mejor método de pago."""
    url = payload.url.strip()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html, */*"
    }

    # 1. Si la URL es una redirección corta (ej: /sec/, mpago.li, etc.)
    if any(domain in url for domain in ["mpago.li", "/sec/", "ml.com.ar", "mercadolibre"]):
        if not re.search(r'ML[A-Z]-?\d{6,}', url, re.IGNORECASE):
            try:
                res = requests.get(url, allow_redirects=True, headers=headers, timeout=6, stream=True)
                if res.url:
                    url = res.url
            except Exception:
                pass

    # 2. Extraer ID del item o producto
    catalog_match = re.search(r'/p/(ML[A-Z]-?\d+)', url, re.IGNORECASE)
    item_match = re.search(r'(ML[A-Z]-?\d{6,})', url, re.IGNORECASE)
    
    item_id = None
    is_catalog = False
    
    if catalog_match:
        item_id = catalog_match.group(1).replace('-', '').upper()
        is_catalog = True
    elif item_match:
        item_id = item_match.group(1).replace('-', '').upper()
    elif re.match(r'^ML[A-Z]-?\d+$', url, re.IGNORECASE):
        item_id = url.replace('-', '').upper()
    else:
        fallback_match = re.search(r'ML[A-Z]\d+', url, re.IGNORECASE)
        if fallback_match:
            item_id = fallback_match.group(0).upper()

    if not item_id:
        raise HTTPException(
            status_code=400, 
            detail="No se encontró un ID de producto en el link. Copiá el link completo de la publicación de Mercado Libre."
        )

    # 3. Consultar la API de Mercado Libre
    price = 0.0
    title = ""
    currency_id = "ARS"
    item_data = None

    # Intentar como item normal primero (si no era explícitamente de catálogo)
    if not is_catalog:
        try:
            resp = requests.get(f"https://api.mercadolibre.com/items/{item_id}", headers=headers, timeout=8)
            if resp.status_code == 200:
                item_data = resp.json()
                price = float(item_data.get("price") or 0.0)
                title = item_data.get("title", "")
                currency_id = item_data.get("currency_id", "ARS")
        except Exception:
            pass

    # Si falló o era de catálogo (/p/...), consultar la API de productos
    if not item_data or price == 0:
        try:
            prod_resp = requests.get(f"https://api.mercadolibre.com/products/{item_id}", headers=headers, timeout=8)
            if prod_resp.status_code == 200:
                prod_data = prod_resp.json()
                buy_box = prod_data.get("buy_box_winner") or {}
                price = float(buy_box.get("price") or prod_data.get("price") or 0.0)
                title = prod_data.get("name") or prod_data.get("title") or "Producto Mercado Libre"
                currency_id = buy_box.get("currency_id") or prod_data.get("currency_id") or "ARS"
                item_data = prod_data
        except Exception:
            pass

    if not item_data or price == 0:
        raise HTTPException(
            status_code=404, 
            detail=f"No pudimos obtener la información de la publicación ({item_id}). Verifica que el producto esté activo en Mercado Libre."
        )
    
    # Obtener cuentas del usuario
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    
    # Evaluar opciones de pago
    options = evaluate_payment_options(
        price=price,
        accounts=accounts,
        tna=payload.custom_tna,
        discount=payload.discount_percentage,
        installments=payload.installments_without_interest
    )
    
    return {
        "ok": True,
        "item": {
            "id": item_id,
            "title": title,
            "price": price,
            "currency": currency_id
        },
        "recommendation": options
    }

@router.post("/analyze-barcode")
async def analyze_barcode(payload: AnalyzeBarcodeRequest, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Busca un producto por GTIN/EAN (código de barras) y recomienda el mejor método de pago."""
    
    # Buscar por GTIN
    search_resp = requests.get(f"https://api.mercadolibre.com/sites/MLA/search?gtin={payload.barcode}&limit=1")
    if search_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Error consultando Mercado Libre")
        
    search_data = search_resp.json()
    results = search_data.get("results", [])
    
    if not results:
        raise HTTPException(status_code=404, detail="No se encontraron publicaciones activas para este código de barras")
        
    item_data = results[0]
    price = item_data.get("price", 0.0)
    title = item_data.get("title", "")
    item_id = item_data.get("id", "")
    
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    
    options = evaluate_payment_options(
        price=price,
        accounts=accounts,
        tna=payload.custom_tna,
        discount=payload.discount_percentage,
        installments=payload.installments_without_interest
    )
    
    return {
        "ok": True,
        "item": {
            "id": item_id,
            "title": title,
            "price": price,
        },
        "recommendation": options
    }
