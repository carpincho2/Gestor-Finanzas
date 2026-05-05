/**
 * TesseractOcrAdapter — Adaptador de Infraestructura
 * 
 * ¿Qué es un Adaptador en Arquitectura Hexagonal?
 * Es la implementación CONCRETA de un Puerto (interfaz).
 * Mientras el Puerto dice "necesito algo que haga OCR",
 * el Adaptador dice "yo lo hago usando Tesseract.js".
 * 
 * ¿Qué es Tesseract.js?
 * Es un port de Tesseract OCR (el motor de OCR más usado del mundo)
 * que corre directamente en el navegador usando Web Workers.
 * - No necesita servidor ni API keys
 * - Soporta +100 idiomas
 * - Funciona offline después de la primera carga
 * - Usa ~2MB para el archivo del idioma español
 * 
 * ¿Cómo funciona internamente?
 * 1. Crea un "Worker" (hilo de background) para no bloquear la UI
 * 2. Descarga el modelo de idioma (~2MB la primera vez)
 * 3. Procesa la imagen pixel por pixel buscando patrones de letras
 * 4. Devuelve texto + nivel de confianza
 * 
 * IMPORTANTE: Heredamos de OcrPort para cumplir el contrato.
 * Si mañana queremos usar Google Cloud Vision, crearíamos un
 * GoogleVisionOcrAdapter que también herede de OcrPort.
 */
import { OcrPort } from '../../application/ports/OcrPort.js';
import { ImagePreprocessor } from '../../shared/ImagePreprocessor.js';

export class TesseractOcrAdapter extends OcrPort {
  constructor() {
    super();
    this.worker = null;
    this.isInitialized = false;
  }

  /**
   * Inicializa el worker de Tesseract y carga el idioma.
   * 
   * ¿Por qué separamos initialize() de recognize()?
   * Porque la inicialización tarda unos segundos (descarga del modelo).
   * Podemos inicializar al abrir el modal de OCR, así cuando el usuario
   * suba la foto el motor ya está listo.
   * 
   * @param {string} language — Código de idioma. 'spa' = español.
   *   Tesseract descarga un archivo .traineddata específico por idioma.
   */
  async initialize(language = 'spa') {
    if (this.isInitialized) return;

    try {
      // Tesseract.js se carga como módulo global desde el CDN.
      // Verificamos que esté disponible.
      if (typeof Tesseract === 'undefined') {
        throw new Error(
          'Tesseract.js no está cargado. Asegurate de incluir el script en el HTML.'
        );
      }

      // Crear el worker: un hilo de background que procesa las imágenes.
      // ¿Por qué un Worker? Porque el OCR es una operación PESADA
      // que tardaría varios segundos. Si lo hacemos en el hilo principal,
      // la UI se congela. Con un Worker, la UI sigue respondiendo.
      this.worker = await Tesseract.createWorker(language, 1, {
        // Logger para reportar progreso al usuario
        logger: (m) => {
          if (this._progressCallback) {
            this._progressCallback({
              status: this.translateStatus(m.status),
              progress: m.progress || 0
            });
          }
        }
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('[TesseractOcrAdapter] Error al inicializar:', error);
      throw new Error(`No se pudo inicializar el motor OCR: ${error.message}`);
    }
  }

  /**
   * Reconoce texto en una imagen.
   * Implementación concreta del método definido en OcrPort.
   * 
   * @param {File|Blob|string} imageSource — La imagen a procesar
   * @param {function} onProgress — Callback de progreso
   * @returns {Promise<{ text: string, confidence: number }>}
   */
  async recognize(imageSource, onProgress) {
    // Guardamos el callback de progreso para que el logger lo use
    this._progressCallback = onProgress;

    // Asegurar que el motor esté inicializado
    if (!this.isInitialized) {
      if (onProgress) onProgress({ status: 'Preparando motor OCR...', progress: 0 });
      await this.initialize();
    }

    try {
      // Preprocesar la imagen para mejorar la precisión del OCR
      if (onProgress) onProgress({ status: 'Mejorando imagen...', progress: 0.05 });
      
      let processedImage = imageSource;
      
      // Solo preprocesamos si es un File o Blob (no una URL string)
      if (imageSource instanceof File || imageSource instanceof Blob) {
        try {
          processedImage = await ImagePreprocessor.process(imageSource);
        } catch (prepError) {
          // Si falla el preprocesamiento, usamos la imagen original
          console.warn('[TesseractOcrAdapter] Preprocesamiento falló, usando imagen original:', prepError);
          processedImage = imageSource;
        }
      }

      // Ejecutar el reconocimiento OCR
      if (onProgress) onProgress({ status: 'Analizando texto...', progress: 0.1 });
      
      const result = await this.worker.recognize(processedImage);

      // Extraer texto y confianza del resultado
      // result.data.text contiene todo el texto reconocido
      // result.data.confidence es un número 0-100
      return {
        text: result.data.text,
        confidence: Math.round(result.data.confidence)
      };

    } catch (error) {
      console.error('[TesseractOcrAdapter] Error en reconocimiento:', error);
      throw new Error(`Error al leer la imagen: ${error.message}`);
    } finally {
      this._progressCallback = null;
    }
  }

  /**
   * Libera los recursos del worker.
   * 
   * ¿Por qué es importante?
   * El Worker ocupa memoria RAM. Si el usuario ya no va a escanear más,
   * liberamos esos recursos. Es buena práctica de gestión de memoria.
   */
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }

  /**
   * Traduce los estados internos de Tesseract a mensajes amigables en español.
   * 
   * Tesseract reporta estados en inglés como:
   * 'loading tesseract core', 'initializing api', 'recognizing text'
   * Nosotros los traducimos para mostrarle al usuario.
   * 
   * @param {string} status — Estado original de Tesseract
   * @returns {string} — Mensaje traducido
   */
  translateStatus(status) {
    const translations = {
      'loading tesseract core': 'Cargando motor OCR...',
      'initializing tesseract': 'Inicializando motor...',
      'initialized tesseract': 'Motor inicializado',
      'loading language traineddata': 'Descargando idioma español...',
      'loaded language traineddata': 'Idioma cargado',
      'initializing api': 'Preparando reconocimiento...',
      'initialized api': 'Listo para reconocer',
      'recognizing text': 'Leyendo texto del ticket...'
    };

    return translations[status] || status;
  }
}
