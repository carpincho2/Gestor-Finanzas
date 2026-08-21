import json
from google import genai
from google.genai import types

class OCRService:
    def __init__(self):
        # The genai.Client() automatically picks up GEMINI_API_KEY from environment variables
        self.client = genai.Client()

    async def process_image(self, image_bytes: bytes) -> list:
        """
        Procesa la imagen de un ticket usando Google Gemini y extrae los productos y precios.
        Devuelve una lista de diccionarios: [{"name": "Producto", "price": 100.5}, ...]
        """
        prompt = (
            "Extraé todos los productos y sus precios finales de este ticket de compra. "
            "Devolvé UNICAMENTE un array JSON válido, donde cada elemento tenga el formato: "
            "{\"name\": \"Nombre del producto\", \"price\": 1250.50}. "
            "No devuelvas subtotales, totales, vueltos ni texto adicional, solo el JSON."
        )

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            result = response.text
            items = json.loads(result)
            
            # Sanitizar y asegurar que tengan name y price numérico
            valid_items = []
            if isinstance(items, list):
                for item in items:
                    name = str(item.get("name", "Producto desconocido"))
                    try:
                        price = float(item.get("price", 0))
                        valid_items.append({"name": name, "price": price})
                    except (ValueError, TypeError):
                        pass
                    
            return valid_items
            
        except Exception as e:
            print(f"Error procesando OCR con Gemini: {e}")
            raise Exception("No se pudo analizar el ticket con inteligencia artificial.")

ocr_service = OCRService()
