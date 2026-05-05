/**
 * ScanReceiptUseCase — Caso de Uso de la Capa de Aplicación
 * 
 * ¿Qué hace un Caso de Uso?
 * ORQUESTA el flujo de negocio. No contiene lógica de dominio (eso lo hace ReceiptParser)
 * ni lógica de infraestructura (eso lo hace TesseractOcrAdapter).
 * Solo coordina los pasos en el orden correcto.
 * 
 * Flujo:
 * 1. Recibe una imagen del usuario (vía la UI)
 * 2. Llama al adaptador OCR para extraer texto de la imagen
 * 3. Llama al parser de dominio para estructurar los datos
 * 4. Devuelve los datos parseados para que la UI los muestre
 * 
 * ¿Por qué NO crea la transacción directamente?
 * Porque queremos que el usuario REVISE los datos antes de confirmar.
 * El OCR puede equivocarse, así que siempre mostramos un formulario editable.
 * La creación final la hace AddTransactionUseCase cuando el usuario confirma.
 */
import { ReceiptParser } from '../../domain/services/ReceiptParser.js';

export class ScanReceiptUseCase {
  /**
   * @param {OcrPort} ocrAdapter — Implementación concreta del motor OCR
   *   (inyectado por main.js gracias a la Inversión de Dependencias)
   */
  constructor(ocrAdapter) {
    this.ocrAdapter = ocrAdapter;
  }

  /**
   * Ejecuta el flujo completo de escaneo.
   * 
   * @param {File|Blob|string} imageSource — Imagen del ticket
   * @param {function} [onProgress] — Callback de progreso para la UI
   *   Se llama con { status: string, progress: number }
   * 
   * @returns {Promise<{
   *   success: boolean,
   *   data: { desc: string, amount: number|null, date: string|null, cat: string, rawText: string } | null,
   *   confidence: number,
   *   error: string | null
   * }>}
   * 
   * ¿Por qué devolvemos un objeto envolvente con success/error?
   * Porque el OCR puede fallar (imagen borrosa, sin texto, etc.)
   * y queremos dar feedback claro al usuario sin lanzar excepciones
   * que rompan el flujo de la UI.
   */
  async execute(imageSource, onProgress) {
    try {
      // Paso 1: Verificar que tenemos una imagen válida
      if (!imageSource) {
        return {
          success: false,
          data: null,
          confidence: 0,
          error: 'No se proporcionó una imagen para escanear.'
        };
      }

      // Paso 2: Ejecutar OCR (infraestructura)
      // El adaptador se encarga de toda la magia de Tesseract.
      // Nosotros solo le decimos "dame el texto de esta imagen".
      const ocrResult = await this.ocrAdapter.recognize(imageSource, onProgress);

      // Paso 3: Verificar que el OCR extrajo algo útil
      if (!ocrResult.text || ocrResult.text.trim().length < 3) {
        return {
          success: false,
          data: null,
          confidence: ocrResult.confidence || 0,
          error: 'No se pudo leer texto en la imagen. Intentá con una foto más clara o con mejor iluminación.'
        };
      }

      // Paso 4: Parsear el texto (dominio puro)
      // ReceiptParser es lógica de negocio: sabe cómo interpretar
      // "$15.430,50" o "28/04/2025" en un ticket argentino.
      const parsedData = ReceiptParser.parse(ocrResult.text);

      // Paso 5: Devolver resultado exitoso
      return {
        success: true,
        data: parsedData,
        confidence: ocrResult.confidence,
        error: null
      };

    } catch (error) {
      // Si algo falla (red, worker de Tesseract, etc.), 
      // devolvemos un error limpio sin romper la app.
      return {
        success: false,
        data: null,
        confidence: 0,
        error: `Error al procesar la imagen: ${error.message}`
      };
    }
  }
}
