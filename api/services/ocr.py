import asyncio
import random

class OCRService:
    @staticmethod
    async def process_image(image_bytes: bytes) -> list:
        """
        Simula el procesamiento OCR de un ticket de supermercado.
        En producción, aquí se llamaría a Tesseract, Google Vision API, o AWS Textract.
        """
        # Simulamos la latencia de procesar una imagen pesada con IA (2 segundos)
        await asyncio.sleep(2.0)
        
        # Generamos una lista falsa de productos detectados
        mock_items = [
            {"name": "Leche La Serenisima 1L", "price": 1250.0},
            {"name": "Pan Bimbo Artesano", "price": 2300.0},
            {"name": "Coca Cola 2.25L", "price": 2800.0},
            {"name": "Queso Crema Casancrem", "price": 1850.0},
            {"name": "Galletitas Oreo", "price": 950.0}
        ]
        
        # Devolvemos un subconjunto aleatorio para que se sienta dinámico
        # entre 2 y 5 productos cada vez
        num_items = random.randint(2, len(mock_items))
        return random.sample(mock_items, num_items)

ocr_service = OCRService()
