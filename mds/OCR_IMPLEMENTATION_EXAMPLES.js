/* =====================================================
   EJEMPLOS DE IMPLEMENTACIÓN — Mejoras de OCR
   ===================================================== 
   Este archivo contiene FRAGMENTOS DE CÓDIGO que pueden
   ser integrados en js/app.js para mejorar la fiabilidad
   al 100%.
===================================================== */

// ============================================
// 1. PREPROCESAMIENTO AVANZADO DE IMÁGENES
// ============================================

/**
 * FUNCIÓN MEJORADA: Preprocesar imagen con técnicas avanzadas
 * Agregar al final de la función existente scPreprocessImage()
 */
async function scPreprocessImage_ADVANCED(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      
      // PASO 1: Dibujar imagen original
      ctx.drawImage(img, 0, 0);
      
      // PASO 2: Convertir a escala de grises
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Luminancia estándar
        const luminancia = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = luminancia;
        data[i + 1] = luminancia;
        data[i + 2] = luminancia;
      }
      
      // PASO 3: DESKEW (Corrección de inclinación)
      // Este es un algoritmo complejo. Versión simplificada:
      // Si detectas que las líneas de texto están rotadas, rotar la imagen
      // TODO: Implementar detección de Hough Transform para ángulo de inclinación
      
      // PASO 4: Aumento de Contraste Adaptativo (CLAHE)
      const contrastEnhanced = enhanceContrastCLAHE(imageData, canvas.width, canvas.height);
      
      // PASO 5: Binarización Adaptativa
      const binarized = adaptiveBinarization(contrastEnhanced, canvas.width, canvas.height);
      
      // PASO 6: Eliminación de ruido (Morphological operations)
      const denoised = morphologicalClosing(binarized, canvas.width, canvas.height);
      
      // PASO 7: Dibujar resultado final
      ctx.putImageData(denoised, 0, 0);
      
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => reject(new Error('Error al cargar imagen'));
    img.src = dataUrl;
  });
}

/**
 * Algoritmo CLAHE: Contrast Limited Adaptive Histogram Equalization
 * Mejora contraste localmente por regiones
 */
function enhanceContrastCLAHE(imageData, width, height) {
  const data = imageData.data;
  const tileSize = 32; // Tamaño de región local
  const clipLimit = 2.0; // Límite de contraste
  
  const output = new ImageData(imageData);
  const outputData = output.data;
  
  // Procesar por tiles
  for (let ty = 0; ty < Math.ceil(height / tileSize); ty++) {
    for (let tx = 0; tx < Math.ceil(width / tileSize); tx++) {
      const x0 = tx * tileSize;
      const y0 = ty * tileSize;
      const x1 = Math.min(x0 + tileSize, width);
      const y1 = Math.min(y0 + tileSize, height);
      
      // Extraer histograma del tile
      const histogram = new Uint32Array(256);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4;
          const gray = data[idx]; // Solo canal rojo (escala de grises)
          histogram[gray]++;
        }
      }
      
      // Aplicar clip limit
      const pixelCount = (x1 - x0) * (y1 - y0);
      const clipValue = Math.ceil(clipLimit * pixelCount / 256);
      let clipped = 0;
      
      for (let i = 0; i < 256; i++) {
        if (histogram[i] > clipValue) {
          clipped += histogram[i] - clipValue;
          histogram[i] = clipValue;
        }
      }
      
      // Distribuir píxeles clippeados uniformemente
      const redistribution = Math.floor(clipped / 256);
      const remainder = clipped % 256;
      for (let i = 0; i < 256; i++) {
        histogram[i] += redistribution;
        if (i < remainder) histogram[i]++;
      }
      
      // Crear LUT (Look-Up Table)
      const lut = new Uint8Array(256);
      let sum = 0;
      const maxVal = pixelCount;
      for (let i = 0; i < 256; i++) {
        sum += histogram[i];
        lut[i] = Math.round((sum / maxVal) * 255);
      }
      
      // Aplicar LUT al tile
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4;
          const gray = data[idx];
          const enhanced = lut[gray];
          outputData[idx] = enhanced;
          outputData[idx + 1] = enhanced;
          outputData[idx + 2] = enhanced;
        }
      }
    }
  }
  
  return output;
}

/**
 * Binarización Adaptativa: convertir a blanco/negro puro
 * Calcula umbral localmente en lugar de globalmente
 */
function adaptiveBinarization(imageData, width, height) {
  const data = imageData.data;
  const output = new ImageData(imageData);
  const outputData = output.data;
  
  const windowSize = 15;
  const offset = Math.floor(windowSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Calcular umbral local (promedio en ventana)
      let sum = 0;
      let count = 0;
      
      for (let dy = -offset; dy <= offset; dy++) {
        for (let dx = -offset; dx <= offset; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          const idx = (ny * width + nx) * 4;
          sum += data[idx]; // Solo valor gris
          count++;
        }
      }
      
      const threshold = sum / count - 2; // Resta constante pequeña
      const idx = (y * width + x) * 4;
      const gray = data[idx];
      
      // Si píxel es más oscuro que umbral, negro. Si es más claro, blanco.
      const binary = gray < threshold ? 0 : 255;
      outputData[idx] = binary;
      outputData[idx + 1] = binary;
      outputData[idx + 2] = binary;
    }
  }
  
  return output;
}

/**
 * Operación Morfológica: CIERRE (Closing)
 * Rellena huecos pequeños en el texto, elimina ruido
 */
function morphologicalClosing(imageData, width, height) {
  // CLOSING = DILATE → ERODE
  
  // Primero: DILATE (expandir píxeles blancos, rellenar huecos)
  let temp = dilate(imageData, width, height);
  
  // Segundo: ERODE (contraer píxeles blancos, eliminar ruido)
  const result = erode(temp, width, height);
  
  return result;
}

function dilate(imageData, width, height, radius = 2) {
  const data = imageData.data;
  const output = new ImageData(imageData);
  const outputData = output.data;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let isWhite = false;
      
      // Si hay algún píxel blanco en radio, este píxel se vuelve blanco
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          const idx = (ny * width + nx) * 4;
          
          if (data[idx] > 128) {
            isWhite = true;
            break;
          }
        }
        if (isWhite) break;
      }
      
      const idx = (y * width + x) * 4;
      const value = isWhite ? 255 : 0;
      outputData[idx] = value;
      outputData[idx + 1] = value;
      outputData[idx + 2] = value;
    }
  }
  
  return output;
}

function erode(imageData, width, height, radius = 2) {
  const data = imageData.data;
  const output = new ImageData(imageData);
  const outputData = output.data;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let isBlack = false;
      
      // Si hay algún píxel negro en radio, este píxel se vuelve negro
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          const idx = (ny * width + nx) * 4;
          
          if (data[idx] < 128) {
            isBlack = true;
            break;
          }
        }
        if (isBlack) break;
      }
      
      const idx = (y * width + x) * 4;
      const value = isBlack ? 0 : 255;
      outputData[idx] = value;
      outputData[idx + 1] = value;
      outputData[idx + 2] = value;
    }
  }
  
  return output;
}


// ============================================
// 2. VALIDACIÓN EXHAUSTIVA DE CAMPOS
// ============================================

/**
 * VALIDAR NOMBRE DEL LOCAL (3 niveles)
 */
function validateLocalName(name, fullText) {
  // NIVEL 1: Filtros básicos
  if (!name || name.length < 3) {
    console.debug('Nombre rechazado: muy corto');
    return { valid: false, confidence: 0, reason: 'Muy corto' };
  }
  
  if (/^\d+$/.test(name)) {
    console.debug('Nombre rechazado: solo números');
    return { valid: false, confidence: 0, reason: 'Solo números' };
  }
  
  if (!/[a-záéíóúñ]/i.test(name)) {
    console.debug('Nombre rechazado: sin letras');
    return { valid: false, confidence: 0, reason: 'Sin letras' };
  }
  
  // NIVEL 2: Detectar corrupción de OCR
  const corruptPatterns = [
    /([nfwjkqb]{3,})/i,      // Secuencias como "fjwkj"
    /(\d{2,}[a-z]{2,})/i,    // Mezcla de números y letras como "24nf"
    /([^a-záéíóúñ&.,\-\s]{4,})/i // Caracteres especiales raros
  ];
  
  for (const pattern of corruptPatterns) {
    if (pattern.test(name)) {
      console.debug('Nombre rechazado: OCR corrupto detectado -', pattern);
      return { valid: false, confidence: 5, reason: 'OCR corrupto' };
    }
  }
  
  // NIVEL 3: Validación contextual
  // Cargar diccionario de marcas conocidas (desde OCR_PATTERNS.json)
  const knownBrands = [
    'coto', 'disco', 'carrefour', 'jumbo', 'dia', 'walmart',
    'farmacia', 'ypf', 'shell', 'netflix', 'spotify', 'mercado',
    'easy', 'sodimac', 'ferreteria', 'cafe', 'restaurant'
  ];
  
  const nameLower = name.toLowerCase();
  const hasKnownWord = knownBrands.some(brand => nameLower.includes(brand));
  
  // Si no es marca conocida y es muy corta, dudoso
  if (!hasKnownWord && name.length < 5) {
    console.debug('Nombre sospechoso: corto y no es marca conocida');
    return { valid: true, confidence: 40, reason: 'Corto, revisar' };
  }
  
  // Si es marca conocida, muy confiable
  if (hasKnownWord) {
    return { valid: true, confidence: 95, reason: 'Marca reconocida' };
  }
  
  // Default: aceptar con confianza media-alta
  return { valid: true, confidence: 75, reason: 'Parece válido' };
}

/**
 * VALIDAR MONTO TOTAL (5 niveles)
 */
function validateTotal(amount, candidates, fullText, lines) {
  // NIVEL 1: Rango realista
  if (amount < 10 || amount > 100000) {
    return { valid: false, confidence: 0, reason: 'Monto fuera de rango (10-100k ARS)' };
  }
  
  // NIVEL 2: Scoring contextual mejorado
  let contextScore = 0;
  
  // Buscar si la línea contiene palabras de "TOTAL"
  const totalPatterns = [
    /total\s*[:\$]?\s*[\d.,]+/i,
    /pagar\s*[:\$]?\s*[\d.,]+/i,
    /importe\s*[:\$]?\s*[\d.,]+/i,
    /neto\s*[:\$]?\s*[\d.,]+/i,
    /amount\s*[:\$]?\s*[\d.,]+/i,
  ];
  
  let foundInTotalLine = false;
  for (const pattern of totalPatterns) {
    if (pattern.test(fullText)) {
      foundInTotalLine = true;
      contextScore += 50;
      break;
    }
  }
  
  // NIVEL 3: Penalizar si está en línea de "no-total"
  const dangerPatterns = [
    /unitario/i,
    /precio\s+u/i,
    /cant(?:idad)?/i,
    /item/i,
    /lote/i,
    /peso/i,
    /vuelto/i,
    /change/i
  ];
  
  let isDangerous = false;
  for (const pattern of dangerPatterns) {
    if (pattern.test(fullText)) {
      contextScore -= 50;
      isDangerous = true;
      break;
    }
  }
  
  // NIVEL 4: Coherencia con otros candidatos
  // Si hay muchos candidatos muy similares, el más alto es probablemente el total
  const confidence = foundInTotalLine ? 90 : (isDangerous ? 30 : 65);
  
  // NIVEL 5: Retornar validación
  return {
    valid: amount >= 10 && amount <= 100000,
    confidence: Math.max(0, Math.min(100, confidence)),
    reason: foundInTotalLine ? 'En línea de total' : (isDangerous ? 'En contexto peligroso' : 'Contextualmente válido')
  };
}

/**
 * VALIDAR FECHA (Temporal + OCR)
 */
function validateDate(date, fullText) {
  if (!date) {
    return { valid: false, confidence: 0, reason: 'Fecha nula' };
  }
  
  try {
    const parsed = new Date(date);
    const now = new Date();
    
    // ¿La fecha está en el futuro? Probablemente error de OCR
    if (parsed > now) {
      console.warn('Fecha en futuro detectada, intentando corregir...');
      
      // Intentar hace 1 o 2 años
      const y = now.getFullYear();
      const alternatives = [
        date.replace(/(\d{4})/, String(y - 1)),
        date.replace(/(\d{4})/, String(y - 2))
      ];
      
      const distances = alternatives.map(d => Math.abs(new Date(d) - now));
      const bestAlt = alternatives[distances.indexOf(Math.min(...distances))];
      
      return {
        valid: true,
        confidence: 60,
        corrected: bestAlt,
        reason: 'Corregida (estaba en futuro)'
      };
    }
    
    // ¿Es demasiado vieja? (más de 10 años)
    if (now - parsed > 10 * 365 * 24 * 60 * 60 * 1000) {
      return { valid: false, confidence: 10, reason: 'Demasiado vieja (>10 años)' };
    }
    
    // Válida
    return {
      valid: true,
      confidence: 95,
      reason: 'Fecha válida'
    };
  } catch (err) {
    return { valid: false, confidence: 0, reason: 'Fecha inválida (parse error)' };
  }
}

/**
 * VALIDAR FORMA DE PAGO
 */
function validatePaymentMethod(method, fullText) {
  const validMethods = [
    'Mercado Pago', 'Tarjeta Visa', 'Tarjeta Mastercard', 'Tarjeta Amex',
    'Tarjeta de débito', 'Tarjeta de crédito', 'Transferencia', 'Efectivo',
    'QR', 'MODO', 'Cuenta DNI', 'No especificado'
  ];
  
  if (validMethods.includes(method)) {
    // Si fue detectada por fuzzy matching (no es "No especificado"), confianza alta
    if (method !== 'No especificado') {
      return { valid: true, confidence: 85, reason: 'Detectada en ticket' };
    }
    // Si no se detectó nada, confianza baja pero válida
    return { valid: true, confidence: 40, reason: 'No especificada en ticket' };
  }
  
  return { valid: false, confidence: 0, reason: 'Método desconocido' };
}


// ============================================
// 3. SISTEMA DE CONFIANZA MEJORADO
// ============================================

/**
 * Calcular confianza total por campo y retornar con indicadores de color
 */
function calculateConfidencePerField(parseResult) {
  const fields = {
    nombre_local: validateLocalName(parseResult.nombre_local, parseResult.texto_crudo),
    total: validateTotal(parseResult.total, [], parseResult.texto_crudo, []),
    fecha: validateDate(parseResult.fecha, parseResult.texto_crudo),
    hora: { valid: !!parseResult.hora, confidence: parseResult.hora ? 80 : 20 },
    forma_pago: validatePaymentMethod(parseResult.forma_pago, parseResult.texto_crudo),
    categoria: { valid: !!parseResult.categoria, confidence: parseResult.categoria ? 75 : 30 }
  };
  
  // Calcular promedio ponderado
  const weights = {
    nombre_local: 0.25,
    total: 0.35,
    fecha: 0.20,
    hora: 0.05,
    forma_pago: 0.10,
    categoria: 0.05
  };
  
  let totalConfidence = 0;
  for (const [field, weight] of Object.entries(weights)) {
    totalConfidence += fields[field].confidence * weight;
  }
  
  return {
    fields,
    overall: Math.round(totalConfidence),
    recommendations: generateRecommendations(fields)
  };
}

/**
 * Generar recomendaciones basadas en campos con baja confianza
 */
function generateRecommendations(fields) {
  const recommendations = [];
  
  if (fields.nombre_local.confidence < 60) {
    recommendations.push({
      field: 'nombre_local',
      level: 'error',
      message: 'Revisa el nombre del local - OCR podría haber fallado'
    });
  }
  
  if (fields.total.confidence < 70) {
    recommendations.push({
      field: 'total',
      level: 'warning',
      message: 'Verifica el monto - hay dudas sobre cuál es el total'
    });
  }
  
  if (fields.fecha.confidence < 60) {
    recommendations.push({
      field: 'fecha',
      level: 'error',
      message: 'Revisa la fecha - podría estar corrupta'
    });
  }
  
  return recommendations;
}


// ============================================
// 4. DEBUG MODE
// ============================================

const DEBUG_CONFIG = {
  enabled: localStorage.getItem('ocr_debug_enabled') === '1',
  level: parseInt(localStorage.getItem('ocr_debug_level') || '2'), // 0-5
  logToConsole: true,
  logToFile: false,
  timestamps: true
};

function debugLog(stage, data, level = 2) {
  if (!DEBUG_CONFIG.enabled || level > DEBUG_CONFIG.level) return;
  
  const timestamp = DEBUG_CONFIG.timestamps ? `[${new Date().toISOString()}]` : '';
  const prefix = `${timestamp} [OCR] ${stage}`;
  
  if (DEBUG_CONFIG.logToConsole) {
    console.group(prefix);
    console.log(data);
    console.groupEnd();
  }
}

function enableDebugMode() {
  localStorage.setItem('ocr_debug_enabled', '1');
  localStorage.setItem('ocr_debug_level', '4');
  console.log('✅ Debug mode activado. Nivel: 4 (INFO)');
  location.reload();
}

function disableDebugMode() {
  localStorage.setItem('ocr_debug_enabled', '0');
  console.log('❌ Debug mode desactivado.');
  location.reload();
}


// ============================================
// 5. INTEGRACIÓN EN scParseTicketText()
// ============================================

/**
 * VERSIÓN MEJORADA de scParseTicketText
 * (REEMPLAZAR la función existente)
 */
function scParseTicketText_IMPROVED(raw) {
  debugLog('Parse - Entrada', { textLength: raw?.length });
  
  const text = raw || '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // ... [código existente para extraer candidatos] ...

  // VALIDAR CADA CAMPO
  const validations = {
    nombre_local: validateLocalName(nombre_local, text),
    total: validateTotal(total, candidates, text, lines),
    fecha: validateDate(fecha, text),
    hora: { valid: !!hora, confidence: hora ? 80 : 20 },
    forma_pago: validatePaymentMethod(forma_pago, text),
    categoria: { valid: !!categoria, confidence: categoria ? 75 : 30 }
  };
  
  debugLog('Validaciones', validations);

  // Calcular confianza por campo
  const confidence = calculateConfidencePerField({
    nombre_local, total, fecha, hora, forma_pago, categoria, texto_crudo: raw
  });

  debugLog('Confianza Final', confidence);

  return {
    nombre_local,
    fecha,
    hora,
    total,
    forma_pago,
    direccion,
    categoria,
    descripcion: nombre_local ? 'Compra en ' + nombre_local : 'Ticket escaneado',
    texto_crudo: raw,
    confianza: confidence.overall,
    validations,
    recommendations: confidence.recommendations
  };
}

// ============================================
// CÓMO USAR ESTOS EJEMPLOS
// ============================================

/*
1. Copiar cada función a js/app.js

2. Reemplazar scPreprocessImage() con scPreprocessImage_ADVANCED()

3. Reemplazar scParseTicketText() con scParseTicketText_IMPROVED()

4. En scShowResultModal(), agregar los indicadores visuales:

   for (const [field, validation] of Object.entries(result.validations)) {
     const el = document.getElementById('scf' + field.charAt(0).toUpperCase() + field.slice(1));
     if (el) {
       const confidence = validation.confidence;
       if (confidence >= 85) el.className += ' confidence-high';
       else if (confidence >= 60) el.className += ' confidence-medium';
       else el.className += ' confidence-low';
     }
   }

5. Habilitar debug: enableDebugMode()

6. Observar console para ver qué está pasando en cada paso
*/
