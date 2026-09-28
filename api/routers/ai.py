import os
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from database import get_db
from models import TicketItem
from schemas import OCRParseRequest, OCRSaveRequest, AIChatRequest, AIInsightsRequest
from security import get_current_user_id
from services.ai_service import AIService

router = APIRouter(prefix="/api", tags=["ai", "ocr"])

@router.post("/ocr/parse")
async def ocr_parse(request: Request, payload: OCRParseRequest, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    provider = os.getenv("AI_PROVIDER", "none").strip().lower()
    text = payload.text
    
    if provider == "none" or not provider:
        return {"fallback": True}
        
    ai_service = AIService(db=db, user_id=user_id)
    return ai_service.parse_ocr(text=text, provider=provider)


@router.post("/ai/chat")
async def ai_chat(payload: AIChatRequest, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    ai_service = AIService(db=db, user_id=user_id)
    
    result = ai_service.chat(
        contexto_financiero=payload.contexto_financiero,
        historial=payload.historial,
        pregunta=payload.pregunta
    )
    
    if isinstance(result, str) and result.startswith("Error"):
        return {"ok": False, "error": result}
        
    return {"ok": True, "reply": result}


@router.post("/ai/insights")
async def ai_insights(payload: AIInsightsRequest, request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    ai_service = AIService(db=db, user_id=user_id)
    return ai_service.generate_insights(contexto_financiero=payload.contexto_financiero)


@router.post("/ocr/save")
async def ocr_save(request: Request, payload: OCRSaveRequest, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    
    store_name = payload.nombre_local.strip() if payload.nombre_local else "Desconocido"
    fecha = payload.fecha.strip() if payload.fecha else datetime.utcnow().strftime("%Y-%m-%d")
    
    saved_count = 0
    for item in payload.articulos:
        db_item = TicketItem(
            user_id=user_id,
            store_name=store_name,
            item_name=item.desc.strip(),
            qty=item.qty,
            unit_price=item.price,
            total_price=item.total,
            date=fecha
        )
        db.add(db_item)
        saved_count += 1
        
    db.commit()
    return {"ok": True, "saved_items": saved_count}
