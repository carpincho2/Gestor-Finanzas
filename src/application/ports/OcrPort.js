/**
 * OcrPort — Puerto de la Capa de Aplicación
 * 
 * ¿Qué es un "Puerto" en Arquitectura Hexagonal?
 * Es un CONTRATO (interfaz) que define QUÉ debe hacer un servicio externo,
 * sin decir CÓMO lo hace. Es como un enchufe: define la forma,
 * pero no le importa qué cable se conecte.
 * 
 * En nuestro caso, el puerto dice:
 * "Necesito algo que reciba una imagen y me devuelva texto."
 * 
 * El ADAPTADOR (TesseractOcrAdapter) es quien implementa este contrato.
 * Si mañana queremos usar Google Vision API en vez de Tesseract,
 * solo creamos un nuevo adaptador — el caso de uso NO cambia.
 * 
 * ¿Por qué JavaScript no tiene "interfaces" como Java?
 * JavaScript no tiene interfaces nativas. Usamos una clase base con métodos
 * que lanzan error si no se sobreescriben. Es un patrón común para
 * simular interfaces y documentar el contrato esperado.
 */
export class OcrPort {

  /**
   * Reconoce texto en una imagen.
   * 
   * @param {File|Blob|HTMLImageElement|string} imageSource — La imagen a procesar.
   *   Puede ser un File (del input), un Blob (de canvas), un elemento <img>, 
   *   o una URL/base64 string.
   * 
   * @param {function} [onProgress] — Callback opcional para reportar progreso.
   *   Recibe un objeto { status: string, progress: number (0-1) }.
   *   Ejemplo: onProgress({ status: 'recognizing text', progress: 0.45 })
   * 
   * @returns {Promise<{ text: string, confidence: number }>}
   *   - text: El texto extraído de la imagen
   *   - confidence: Nivel de confianza del OCR (0-100)
   * 
   * @throws {Error} Si el adaptador concreto no implementa este método.
   */
  async recognize(imageSource, onProgress) {
    throw new Error(
      'OcrPort.recognize() no está implementado. ' +
      'Debes crear un adaptador concreto (ej: TesseractOcrAdapter) que implemente este método.'
    );
  }

  /**
   * Inicializa el motor de OCR (carga de modelos, workers, etc).
   * Algunos motores necesitan una fase de setup antes de poder usarse.
   * 
   * @param {string} [language='spa'] — Código de idioma para el OCR.
   * @returns {Promise<void>}
   */
  async initialize(language = 'spa') {
    throw new Error(
      'OcrPort.initialize() no está implementado. ' +
      'Debes crear un adaptador concreto que implemente este método.'
    );
  }

  /**
   * Libera los recursos del motor de OCR (workers, memoria, etc).
   * Se llama cuando ya no necesitamos el OCR.
   * 
   * @returns {Promise<void>}
   */
  async terminate() {
    throw new Error(
      'OcrPort.terminate() no está implementado. ' +
      'Debes crear un adaptador concreto que implemente este método.'
    );
  }
}
