import os
import json
import time
import requests
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from google import genai
from google.genai import types
from google.genai.errors import APIError

from database import get_db
from models import TicketItem
from schemas import OCRParseRequest, OCRSaveRequest, AIChatRequest, AIInsightsRequest
from security import get_current_user_id

router = APIRouter(prefix="/api", tags=["ai", "ocr"])

# Initialize Gemini Client automatically loading GEMINI_API_KEY from environment variables
client = genai.Client()

def _call_gemini_sdk_with_retry(prompt: str, model_name: str = "gemini-2.5-flash", max_retries: int = 3, expect_json: bool = True, system_instruction: Optional[str] = None, contents = None):
    for attempt in range(max_retries + 1):
        try:
            config_args = {}
            if expect_json:
                config_args["response_mime_type"] = "application/json"
            if system_instruction:
                config_args["system_instruction"] = system_instruction
                
            config = types.GenerateContentConfig(**config_args) if config_args else None
            
            if contents is not None:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config
                )
            else:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config
                )
            
            raw_text = response.text or ""
            if expect_json:
                try:
                    return json.loads(raw_text)
                except Exception as e:
                    return {"fallback": True, "error": f"Error al parsear el JSON retornado: {str(e)}", "raw": raw_text}
            return raw_text

        except APIError as api_err:
            if api_err.code == 429:
                if attempt < max_retries:
                    wait_time = 2 ** (attempt + 1)
                    print(f"[Gemini SDK] Límite de cuota (429). Reintentando en {wait_time}s... (Intento {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                else:
                    msg = "Límite de peticiones de Gemini excedido. Esperá un momento y volvé a intentar."
                    return {"fallback": True, "error": msg} if expect_json else f"Error: {msg}"
            else:
                msg = f"Error de la API de Gemini: {api_err.message} (Código {api_err.code})"
                return {"fallback": True, "error": msg} if expect_json else f"Error: {msg}"
                
        except Exception as e:
            msg = f"Error inesperado al conectar con Gemini: {str(e)}"
            return {"fallback": True, "error": msg} if expect_json else f"Error: {msg}"
            
    return {"fallback": True, "error": "Se superaron los reintentos máximos"} if expect_json else "Error: Reintentos agotados"

@router.post("/ocr/parse")
async def ocr_parse(request: Request, payload: OCRParseRequest):
    user_id = get_current_user_id(request)
    provider = os.getenv("AI_PROVIDER", "none").strip().lower()
    text = payload.text
    
    if provider == "none" or not provider:
        return {"fallback": True}
    
    prompt = f"""Sos un experto en interpretar texto OCR de tickets de supermercados y comercios argentinos.
El texto que vas a recibir fue extraído con OCR (Tesseract) y puede contener errores de lectura.

**REGLAS CLAVE:**
1. "nombre_local" SIEMPRE es el nombre del comercio o negocio. NUNCA pongas "TOTAL", "SUBTOTAL", "PAGAR", montos o códigos numéricos como nombre.
2. Corregí errores comunes de OCR: "C0T0"→"Coto", "D1SC0"→"Disco", "CARRREF0UR"→"Carrefour", "JUMB0"→"Jumbo", "McD0NALDS"→"McDonalds", "Y.P.F"→"YPF".
3. Si no podés determinar un campo con seguridad, devolvé null para ese campo.
4. La "categoria" debe ser UNA de las opciones exactas listadas abajo.
5. Los precios están en pesos argentinos (ARS). El separador decimal puede ser "," o ".".

**EJEMPLO 1:**
Texto OCR: "C0T0 C.I.C.S.A\\nSuc. 213\\n22/05/2026 14:32\\nLECHE ENTERA 1L    $1.250,00\\nPAN LACTAL         $890,50\\nTOTAL              $2.140,50\\nEFECTIVO           $3.000,00\\nVUELTO             $859,50"
Respuesta correcta:
{{"nombre_local":"Coto","fecha":"2026-05-22","hora":"14:32","total":2140.50,"forma_pago":"Efectivo","direccion":null,"categoria":"Supermercado / Almacén","articulos":[{{"qty":1.0,"desc":"Leche Entera 1L","price":1250.00,"total":1250.00}},{{"qty":1.0,"desc":"Pan Lactal","price":890.50,"total":890.50}}]}}

**EJEMPLO 2:**
Texto OCR: "D1SC0\\nAv. Santa Fe 1234\\n01/06/2026\\nCOCA COLA 1.5L x2  $2.500,00\\nTOTAL: $2.500,00\\nTarjeta Debito"
Respuesta correcta:
{{"nombre_local":"Disco","fecha":"2026-06-01","hora":null,"total":2500.00,"forma_pago":"Tarjeta de débito","direccion":"Av. Santa Fe 1234","categoria":"Supermercado / Almacén","articulos":[{{"qty":2.0,"desc":"Coca Cola 1.5L","price":1250.00,"total":2500.00}}]}}

**FORMATO DE RESPUESTA (JSON estricto):**
{{
  "nombre_local": "Nombre real del comercio (corregido de errores OCR)",
  "fecha": "YYYY-MM-DD o null",
  "hora": "HH:MM o null",
  "total": monto_total_float,
  "forma_pago": "Método de pago o null",
  "direccion": "Dirección del local o null",
  "categoria": "Una de: 'Supermercado / Almacén', 'Salidas / Restaurantes', 'Transporte', 'Hogar / Servicios', 'Entretenimiento / Suscripciones', 'Salud / Farmacia', 'Compras / Ropa', 'Educación', 'Ingresos (Sueldo/Freelance)', 'Ahorro / Inversiones', 'Otros'",
  "articulos": [
    {{
      "qty": cantidad_float,
      "desc": "Descripción del artículo",
      "price": precio_unitario_float,
      "total": precio_total_float
    }}
  ]
}}

**Texto OCR del ticket a analizar:**
{text}
"""

    try:
        if provider == "ollama":
            ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434").strip()
            ollama_model = os.getenv("OLLAMA_MODEL", "llama3").strip()
            
            response = requests.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                },
                timeout=60
            )
            if response.status_code == 200:
                res_data = response.json()
                raw_response = res_data.get("response", "{}")
                parsed_data = json.loads(raw_response)
                return parsed_data
            else:
                return {"fallback": True, "error": f"Ollama returned status {response.status_code}"}
                
        elif provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY", "").strip()
            if not api_key:
                return {"fallback": True, "error": "Gemini API Key missing"}
            
            result = _call_gemini_sdk_with_retry(
                prompt=prompt,
                model_name="gemini-2.5-flash",
                expect_json=True
            )
            return result
                
    except Exception as e:
        print(f"Error parsing with AI provider '{provider}': {e}")
        return {"fallback": True, "error": str(e)}

    return {"fallback": True}

@router.post("/ai/chat")
async def ai_chat(payload: AIChatRequest, request: Request):
    user_id = get_current_user_id(request)
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"error": "Gemini API Key missing"}

    system_prompt = f"""Sos un asistente financiero personal experto que habla español argentino (usá "vos", "te", "podés"). Sos amigable, directo y muy práctico. Das consejos específicos y accionables.
Siempre respondés en base al contexto financiero real del usuario que se te proporciona.
Usás emojis con moderación para hacer la respuesta más clara. Respondés de forma concisa pero completa. Nunca inventás datos que no están en el contexto.

{payload.contexto_financiero}"""

    contents = []
    for msg in payload.historial:
        role = "model" if msg.role == "assistant" else "user"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg.content)]
            )
        )
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=payload.pregunta)]
        )
    )

    result = _call_gemini_sdk_with_retry(
        prompt="",
        model_name="gemini-2.5-flash",
        expect_json=False,
        system_instruction=system_prompt,
        contents=contents
    )
    return {"ok": True, "reply": result}

@router.post("/ai/insights")
async def ai_insights(payload: AIInsightsRequest, request: Request):
    user_id = get_current_user_id(request)
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"error": "Gemini API Key missing"}

    prompt = f"""{payload.contexto_financiero}

Generá exactamente 4 insights financieros en formato JSON. Respondé SOLO con el JSON, sin texto extra, sin markdown (no uses ```json ni backticks), sin comentarios.

Formato:
[
  {{
    "tipo": "positivo|negativo|neutro|alerta",
    "titulo": "Título corto (max 6 palabras)",
    "descripcion": "Descripción concisa y accionable (max 2 oraciones en español argentino)",
    "icono": "emoji"
  }}
]

Los tipos: "positivo" = buena noticia, "negativo" = preocupación, "neutro" = observación, "alerta" = urgente.
Basate 100% en los datos reales del contexto."""

    result = _call_gemini_sdk_with_retry(
        prompt=prompt,
        model_name="gemini-2.5-flash",
        expect_json=True
    )
    if isinstance(result, dict) and result.get("fallback") and result.get("error"):
        return {"ok": False, "error": result.get("error")}
    return {"ok": True, "cards": result}

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
