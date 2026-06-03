/**
 * ImagePreprocessor — Utilidad Compartida
 * 
 * ¿Por qué preprocesar la imagen antes del OCR?
 * Los motores de OCR funcionan MUCHO mejor con imágenes:
 * - En escala de grises (sin colores que distraigan)
 * - Con alto contraste (texto negro sobre fondo blanco)
 * - Binarizadas (solo blanco y negro puros, sin grises)
 * 
 * Una foto de un ticket tomada con el celular suele tener:
 * - Sombras, reflejos y colores de fondo
 * - Baja resolución o desenfoque
 * - Texto gris claro sobre papel blanco
 * 
 * Este preprocessor mejora la imagen ANTES de enviarla al OCR
 * para maximizar la precisión del reconocimiento.
 * 
 * ¿Cómo funciona?
 * Usa un <canvas> en memoria para manipular los píxeles de la imagen.
 * El Canvas API nos da acceso directo a cada pixel (RGBA) y podemos
 * transformarlos matemáticamente.
 */
export class ImagePreprocessor {

  /**
   * Preprocesa una imagen para mejorar el OCR.
   * 
   * @param {File|Blob} imageFile — La imagen original del usuario
   * @returns {Promise<Blob>} — La imagen procesada como Blob (lista para el OCR)
   * 
   * Flujo interno:
   * 1. Cargar la imagen en un elemento <img>
   * 2. Dibujarla en un <canvas>
   * 3. Obtener los datos de pixels (ImageData)
   * 4. Aplicar: escala de grises → contraste → binarización
   * 5. Exportar el canvas como Blob
   */
  static async process(imageFile) {
    // Paso 1: Convertir el archivo a una URL temporal para cargarlo en un <img>
    const imageUrl = URL.createObjectURL(imageFile);
    
    try {
      // Paso 2: Cargar la imagen
      const img = await this.loadImage(imageUrl);
      
      // Paso 3: Crear un canvas del mismo tamaño que la imagen
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Limitamos el tamaño máximo para evitar problemas de memoria
      // y mejorar la velocidad del OCR. 2000px es suficiente para leer texto.
      const maxDimension = 2000;
      let { width, height } = img;
      
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Paso 4: Dibujar la imagen en el canvas
      ctx.drawImage(img, 0, 0, width, height);
      
      // Paso 5: Obtener los datos de píxeles
      // ImageData contiene un array plano de [R, G, B, A, R, G, B, A, ...]
      // donde cada pixel tiene 4 valores (Rojo, Verde, Azul, Alpha)
      const imageData = ctx.getImageData(0, 0, width, height);
      
      // Paso 6: Aplicar transformaciones
      this.toGrayscale(imageData);
      this.increaseContrast(imageData, 50); // Factor de contraste 50%
      this.binarize(imageData, 140); // Umbral de binarización
      
      // Paso 7: Poner los datos procesados de vuelta en el canvas
      ctx.putImageData(imageData, 0, 0);
      
      // Paso 8: Exportar como Blob
      return await this.canvasToBlob(canvas);
      
    } finally {
      // Siempre liberamos la URL temporal para evitar memory leaks
      URL.revokeObjectURL(imageUrl);
    }
  }

  /**
   * Carga una imagen desde una URL en un elemento <img>.
   * 
   * ¿Por qué es asíncrono?
   * Porque el navegador necesita DESCARGAR/DECODIFICAR la imagen,
   * lo cual toma tiempo. Usamos una Promise para esperar.
   * 
   * @param {string} src — URL de la imagen (puede ser blob:// o data://)
   * @returns {Promise<HTMLImageElement>}
   */
  static loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = src;
    });
  }

  /**
   * Convierte la imagen a escala de grises.
   * 
   * Fórmula estándar (luminosidad ponderada):
   *   Gris = 0.299 * R + 0.587 * G + 0.114 * B
   * 
   * ¿Por qué estos números específicos?
   * Porque el ojo humano es más sensible al verde (0.587)
   * que al rojo (0.299) o azul (0.114). Esta fórmula produce
   * grises que se ven "naturales" al ojo humano.
   * 
   * @param {ImageData} imageData — Datos de píxeles del canvas
   */
  static toGrayscale(imageData) {
    const data = imageData.data;
    // Iteramos de 4 en 4 porque cada pixel tiene 4 canales (R, G, B, A)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];     // Rojo
      const g = data[i + 1]; // Verde
      const b = data[i + 2]; // Azul
      // data[i + 3] es Alpha (transparencia), no lo tocamos
      
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      
      // Asignamos el mismo valor gris a R, G y B
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
  }

  /**
   * Aumenta el contraste de la imagen.
   * 
   * ¿Cómo funciona?
   * Toma cada pixel y lo "empuja" más lejos del gris medio (128).
   * Los píxeles claros se hacen más claros.
   * Los píxeles oscuros se hacen más oscuros.
   * 
   * Fórmula: nuevoValor = factor * (valor - 128) + 128
   * 
   * @param {ImageData} imageData
   * @param {number} amount — Cantidad de contraste (0-100). 50 es un buen balance.
   */
  static increaseContrast(imageData, amount) {
    const data = imageData.data;
    // Convertimos el amount (0-100) a un factor multiplicador
    // factor > 1 = más contraste, factor < 1 = menos contraste
    const factor = (259 * (amount + 255)) / (255 * (259 - amount));
    
    for (let i = 0; i < data.length; i += 4) {
      // Aplicamos a R, G y B (no a Alpha)
      data[i]     = this.clamp(factor * (data[i] - 128) + 128);
      data[i + 1] = this.clamp(factor * (data[i + 1] - 128) + 128);
      data[i + 2] = this.clamp(factor * (data[i + 2] - 128) + 128);
    }
  }

  /**
   * Binariza la imagen: convierte todo a blanco puro o negro puro.
   * 
   * ¿Cómo funciona?
   * Si un pixel es más claro que el umbral → blanco (255)
   * Si un pixel es más oscuro que el umbral → negro (0)
   * 
   * Esto elimina toda ambigüedad y deja solo texto negro sobre fondo blanco,
   * que es lo ideal para el OCR.
   * 
   * @param {ImageData} imageData
   * @param {number} threshold — Umbral (0-255). 140 funciona bien para tickets.
   *   Valores más bajos = más negro. Valores más altos = más blanco.
   */
  static binarize(imageData, threshold) {
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Usamos solo el canal R (ya debería ser gris por toGrayscale)
      const value = data[i] > threshold ? 255 : 0;
      
      data[i]     = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
  }

  /**
   * Limita un valor al rango 0-255.
   * 
   * ¿Por qué es necesario?
   * Las operaciones de contraste pueden producir valores fuera del rango
   * válido de un byte (0-255). Sin clamp, el canvas mostraría artefactos.
   * 
   * @param {number} value
   * @returns {number} — Valor entre 0 y 255
   */
  static clamp(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  /**
   * Convierte un canvas a Blob de forma asíncrona.
   * 
   * ¿Por qué usamos image/png?
   * PNG es sin pérdida de calidad (a diferencia de JPEG).
   * Para OCR necesitamos la máxima nitidez posible.
   * 
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise<Blob>}
   */
  static canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Error al convertir canvas a Blob')),
        'image/png'
      );
    });
  }
}
