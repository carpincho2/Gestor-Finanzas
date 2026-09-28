import os
import json
import time
import requests
from typing import Optional, List
from datetime import datetime

from google import genai
from google.genai import types
from google.genai.errors import APIError

from sqlalchemy.orm import Session
from infrastructure.repositories.sqlalchemy_account_repository import SQLAlchemyAccountRepository
from infrastructure.repositories.sqlalchemy_transaction_repository import SQLAlchemyTransactionRepository
from models import Transaction

client = genai.Client()

class AIService:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()

    def get_tools(self):
        # We need a reference to the instance variables inside the tools
        db = self.db
        user_id = self.user_id

        def get_accounts_balance() -> dict:
            """Obtiene el balance de todas las cuentas del usuario. Útil para responder preguntas sobre cuánto dinero tiene disponible."""
            repo = SQLAlchemyAccountRepository(db)
            accounts = repo.get_by_user_id(user_id)
            return {"accounts": [{"id": acc.id, "name": acc.name, "balance": acc.balance, "currency": acc.currency} for acc in accounts]}

        def create_transaction(amount: float, desc: str, type: str, account_id: int, cat: str, date: str) -> dict:
            """Crea una nueva transaccion financiera (ingreso o gasto) para el usuario.
            
            Args:
                amount: El monto de la transaccion.
                desc: Descripcion breve de la transaccion.
                type: Tipo de transaccion ('income' o 'expense').
                account_id: ID de la cuenta bancaria o billetera.
                cat: Categoria de la transaccion.
                date: Fecha en formato YYYY-MM-DD.
            """
            tx_repo = SQLAlchemyTransactionRepository(db)
            tx = Transaction(
                user_id=user_id,
                account_id=account_id,
                type=type,
                desc=desc,
                amount=amount,
                cat=cat,
                date=date
            )
            tx_repo.create(tx)
            
            # Update account balance
            acc_repo = SQLAlchemyAccountRepository(db)
            account = acc_repo.get_by_id_and_user_id(account_id, user_id)
            if account:
                if type == "income":
                    account.balance += amount
                else:
                    account.balance -= amount
                acc_repo.update(account)
                
            return {"status": "success", "transaction_id": tx.id, "new_balance": account.balance if account else None}

        return [get_accounts_balance, create_transaction]

    def _call_gemini_sdk_with_retry(
        self, 
        prompt: str, 
        model_name: str = "gemini-2.5-flash", 
        max_retries: int = 3, 
        expect_json: bool = True, 
        system_instruction: Optional[str] = None, 
        contents: List = None,
        use_tools: bool = False
    ):
        for attempt in range(max_retries + 1):
            try:
                config_args = {}
                if expect_json:
                    config_args["response_mime_type"] = "application/json"
                if system_instruction:
                    config_args["system_instruction"] = system_instruction
                
                # Setup tools if requested
                if use_tools:
                    config_args["tools"] = self.get_tools()
                    
                config = types.GenerateContentConfig(**config_args) if config_args else None
                
                # Support multi-turn automatic tool calling
                if use_tools:
                    # In python SDK, we can just use chats for automatic function calling!
                    # Or manually handle tool calls. Let's let the SDK handle it if we use chats,
                    # but if we just use generate_content we have to manually call them unless we use client.chats
                    pass

                # Actually, the google-genai SDK's chat session automatically calls tools if they are Python functions
                if use_tools and contents is not None:
                    # Actually, the google-genai SDK's chat session automatically calls tools if they are Python functions
                    history_contents = []
                    for msg in contents[:-1]: # All except the last user message
                        history_contents.append(types.Content(role=msg.role, parts=msg.parts))
                        
                    chat = client.chats.create(model=model_name, config=config, history=history_contents)
                    
                    last_msg = contents[-1]
                    response = chat.send_message(last_msg.parts[0].text)
                else:
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
                        print(f"[Gemini SDK] Límite de cuota (429). Reintentando en {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        msg = "Límite de peticiones de Gemini excedido. Esperá un momento."
                        return {"fallback": True, "error": msg} if expect_json else f"Error: {msg}"
                else:
                    msg = f"Error de la API de Gemini: {api_err.message} (Código {api_err.code})"
                    return {"fallback": True, "error": msg} if expect_json else f"Error: {msg}"
            except Exception as e:
                msg = f"Error inesperado al conectar con Gemini: {str(e)}"
                return {"fallback": True, "error": msg} if expect_json else f"Error: {msg}"
                
        return {"fallback": True, "error": "Reintentos agotados"} if expect_json else "Error: Reintentos agotados"

    def parse_ocr(self, text: str, provider: str = "gemini"):
        prompt = f"""Sos un experto en interpretar texto OCR de tickets de supermercados y comercios argentinos.
El texto que vas a recibir fue extraído con OCR (Tesseract) y puede contener errores de lectura.

**REGLAS CLAVE:**
1. "nombre_local" SIEMPRE es el nombre del comercio o negocio. NUNCA pongas "TOTAL", "SUBTOTAL", "PAGAR", montos o códigos numéricos como nombre.
2. Corregí errores comunes de OCR: "C0T0"→"Coto", "D1SC0"→"Disco", "CARRREF0UR"→"Carrefour", "JUMB0"→"Jumbo", "McD0NALDS"→"McDonalds", "Y.P.F"→"YPF".
3. Si no podés determinar un campo con seguridad, devolvé null para ese campo.
4. La "categoria" debe ser UNA de las opciones exactas listadas abajo.
5. Los precios están en pesos argentinos (ARS). El separador decimal puede ser "," o ".".

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
        if provider == "ollama":
            ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434").strip()
            ollama_model = os.getenv("OLLAMA_MODEL", "llama3").strip()
            response = requests.post(
                f"{ollama_url}/api/generate",
                json={"model": ollama_model, "prompt": prompt, "stream": False, "format": "json"},
                timeout=60
            )
            if response.status_code == 200:
                res_data = response.json()
                return json.loads(res_data.get("response", "{}"))
            return {"fallback": True, "error": f"Ollama returned {response.status_code}"}
            
        elif provider == "gemini":
            if not self.api_key:
                return {"fallback": True, "error": "Gemini API Key missing"}
            return self._call_gemini_sdk_with_retry(prompt=prompt, expect_json=True)
            
        return {"fallback": True}

    def chat(self, contexto_financiero: str, historial: list, pregunta: str):
        if not self.api_key:
            return "Gemini API Key missing"

        system_prompt = f"""Sos un asistente financiero personal experto que habla español argentino (usá "vos", "te", "podés"). Sos amigable, directo y muy práctico. Das consejos específicos y accionables.
Siempre respondés en base al contexto financiero real del usuario que se te proporciona.
Podés realizar acciones por el usuario usando las herramientas disponibles, como crear transacciones o verificar saldos.
Usás emojis con moderación para hacer la respuesta más clara. Respondés de forma concisa pero completa. Nunca inventás datos que no están en el contexto.

{contexto_financiero}"""

        contents = []
        for msg in historial:
            role = "model" if msg.role == "assistant" else "user"
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg.content)]))
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=pregunta)]))

        result = self._call_gemini_sdk_with_retry(
            prompt="",
            model_name="gemini-2.5-flash",
            expect_json=False,
            system_instruction=system_prompt,
            contents=contents,
            use_tools=True
        )
        return result

    def generate_insights(self, contexto_financiero: str):
        if not self.api_key:
            return {"ok": False, "error": "Gemini API Key missing"}

        prompt = f"""{contexto_financiero}

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

        result = self._call_gemini_sdk_with_retry(
            prompt=prompt,
            model_name="gemini-2.5-flash",
            expect_json=True
        )
        if isinstance(result, dict) and result.get("fallback") and result.get("error"):
            return {"ok": False, "error": result.get("error")}
        return {"ok": True, "cards": result}
