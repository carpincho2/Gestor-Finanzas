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
    # Extraer ID del item (ej. MLA123456)
    match = re.search(r'(MLA-?\d+)', payload.url)
    if not match:
        raise HTTPException(status_code=400, detail="URL inválida o ID de artículo no encontrado")
    
    item_id = match.group(1).replace('-', '')
    
    # Obtener datos del item de ML
    resp = requests.get(f"https://api.mercadolibre.com/items/{item_id}")
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Artículo no encontrado en Mercado Libre")
    
    item_data = resp.json()
    price = item_data.get("price", 0.0)
    title = item_data.get("title", "")
    
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
            "currency": item_data.get("currency_id")
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
