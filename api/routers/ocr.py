from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from security import get_current_user_id
from services.ocr import ocr_service
import fastapi

# Required for file uploads in FastAPI
try:
    import python_multipart
except ImportError:
    pass

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

@router.post("/scan-ticket")
async def scan_ticket(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id)
):
    """
    Recibe una imagen JPG/PNG de un ticket y usa IA/OCR para detectar los productos.
    Requiere que el usuario esté autenticado.
    """
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        return JSONResponse(status_code=400, content={"error": "Solo se permiten imágenes (PNG/JPG)"})
        
    try:
        image_bytes = await file.read()
        items = await ocr_service.process_image(image_bytes)
        
        return {
            "ok": True,
            "items": items,
            "message": f"Se detectaron {len(items)} productos."
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Error procesando la imagen: {str(e)}"})
