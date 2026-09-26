from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional

from security import get_current_user_id
from infrastructure.dependencies import get_shopping_service
from services.shopping_service import ShoppingService

router = APIRouter(prefix="/api/shopping", tags=["shopping"])

class AnalyzeUrlRequest(BaseModel):
    url: str
    discount_percentage: Optional[float] = 0.0
    installments_without_interest: Optional[int] = 0 # 0 = Autodetectar mejor cuota
    custom_tna: Optional[float] = 40.0 # Tasa nominal anual
    price: Optional[float] = None       # Precio manual opcional

class AnalyzeBarcodeRequest(BaseModel):
    barcode: str
    discount_percentage: Optional[float] = 0.0
    installments_without_interest: Optional[int] = 0
    custom_tna: Optional[float] = 40.0

@router.get("/search")
async def search_items(
    q: str = Query(...),
    shopping_service: ShoppingService = Depends(get_shopping_service)
):
    """Busca productos en Mercado Libre por palabra clave."""
    return shopping_service.search_items(q)

@router.post("/analyze-url")
async def analyze_url(
    payload: AnalyzeUrlRequest,
    user_id: int = Depends(get_current_user_id),
    shopping_service: ShoppingService = Depends(get_shopping_service)
):
    """Analiza una URL de ML y recomienda el mejor método de pago."""
    return shopping_service.analyze_url(payload, user_id)

@router.post("/analyze-barcode")
async def analyze_barcode(
    payload: AnalyzeBarcodeRequest,
    user_id: int = Depends(get_current_user_id),
    shopping_service: ShoppingService = Depends(get_shopping_service)
):
    """Busca un producto por GTIN/EAN (código de barras) y recomienda el mejor método de pago."""
    return shopping_service.analyze_barcode(payload, user_id)
