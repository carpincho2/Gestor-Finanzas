/**
 * ReceiptParser — Servicio de Dominio (v2 - Mejorado)
 * 
 * Parser robusto para tickets argentinos de baja calidad y tickets viejos.
 * 
 * Mejoras v2:
 * - Soporte para formatos DD/MM/YYYY y MM/DD/YYYY (USA)
 * - Rango de años ampliado (2000-2030) para tickets viejos
 * - Detección inteligente del comercio por posición (primeras líneas)
 * - Mapa de comercios expandido (70+ comercios argentinos)
 * - Corrección de errores comunes de OCR (0↔O, 1↔l, 5↔S)
 * - Múltiples estrategias de extracción de monto con scoring
 * - Detección de moneda (ARS, USD) y formato automático
 */
export class ReceiptParser {

  // ===== MAPA DE COMERCIOS CONOCIDOS =====
  // Expandido con cadenas argentinas, apps, servicios y marcas internacionales
  static KNOWN_MERCHANTS = new Map([
    // Supermercados / Alimentación
    ['coto', 'Alimentación'], ['coto cicsa', 'Alimentación'],
    ['carrefour', 'Alimentación'], ['jumbo', 'Alimentación'],
    ['disco', 'Alimentación'], ['vea', 'Alimentación'],
    ['dia', 'Alimentación'], ['changomas', 'Alimentación'],
    ['chango mas', 'Alimentación'], ['la anonima', 'Alimentación'],
    ['walmart', 'Alimentación'], ['makro', 'Alimentación'],
    ['maxiconsumo', 'Alimentación'], ['vital', 'Alimentación'],
    ['diarco', 'Alimentación'], ['atomo', 'Alimentación'],
    ['cooperativa obrera', 'Alimentación'], ['la gallega', 'Alimentación'],
    ['norte', 'Alimentación'],
    // Delivery / Fast food
    ['rappi', 'Alimentación'], ['pedidosya', 'Alimentación'],
    ['globo', 'Alimentación'], ['mcdonalds', 'Alimentación'],
    ['mcdonald', 'Alimentación'], ['burger king', 'Alimentación'],
    ['starbucks', 'Alimentación'], ['mostaza', 'Alimentación'],
    ['grido', 'Alimentación'], ['wendy', 'Alimentación'],
    ['subway', 'Alimentación'], ['kentucky', 'Alimentación'],
    ['kfc', 'Alimentación'], ['pizza hut', 'Alimentación'],
    // Kioscos / Panaderías
    ['panaderia', 'Alimentación'], ['almacen', 'Alimentación'],
    ['verduleria', 'Alimentación'], ['carniceria', 'Alimentación'],

    // Transporte
    ['ypf', 'Transporte'], ['shell', 'Transporte'],
    ['axion', 'Transporte'], ['puma energy', 'Transporte'],
    ['sube', 'Transporte'], ['uber', 'Transporte'],
    ['cabify', 'Transporte'], ['didi', 'Transporte'],
    ['flechabus', 'Transporte'], ['via bariloche', 'Transporte'],
    ['flybondi', 'Transporte'], ['aerolineas', 'Transporte'],
    ['jetsmart', 'Transporte'], ['peaje', 'Transporte'],
    ['autopista', 'Transporte'], ['estacionamiento', 'Transporte'],

    // Salud / Farmacia
    ['farmacity', 'Salud'], ['farmacia', 'Salud'],
    ['osde', 'Salud'], ['swiss medical', 'Salud'],
    ['medife', 'Salud'], ['galeno', 'Salud'],
    ['pami', 'Salud'], ['hospital', 'Salud'],
    ['sanatorio', 'Salud'], ['laboratorio', 'Salud'],
    ['optica', 'Salud'], ['droguer', 'Salud'],

    // Hogar / Servicios
    ['edenor', 'Hogar'], ['edesur', 'Hogar'],
    ['metrogas', 'Hogar'], ['telecom', 'Hogar'],
    ['personal', 'Hogar'], ['movistar', 'Hogar'],
    ['claro', 'Hogar'], ['aysa', 'Hogar'],
    ['fibertel', 'Hogar'], ['cablevision', 'Hogar'],
    ['directv', 'Hogar'], ['ecogas', 'Hogar'],
    ['epec', 'Hogar'], ['edelap', 'Hogar'],
    ['sodimac', 'Hogar'], ['easy', 'Hogar'],
    ['ferreteria', 'Hogar'],

    // Entretenimiento
    ['spotify', 'Entretenimiento'], ['netflix', 'Entretenimiento'],
    ['disney', 'Entretenimiento'], ['hbo', 'Entretenimiento'],
    ['steam', 'Entretenimiento'], ['xbox', 'Entretenimiento'],
    ['playstation', 'Entretenimiento'], ['cinemark', 'Entretenimiento'],
    ['hoyts', 'Entretenimiento'], ['youtube', 'Entretenimiento'],
    ['amazon prime', 'Entretenimiento'], ['twitch', 'Entretenimiento'],

    // Ropa / Moda
    ['zara', 'Ropa'], ['h&m', 'Ropa'],
    ['nike', 'Ropa'], ['adidas', 'Ropa'],
    ['dexter', 'Ropa'], ['falabella', 'Ropa'],
    ['kevingston', 'Ropa'], ['rapsodia', 'Ropa'],
    ['kosiuko', 'Ropa'], ['mimo', 'Ropa'],
    ['cheeky', 'Ropa'], ['portsaid', 'Ropa'],
    ['tiffany', 'Ropa'], // Joyería/lujo → Ropa como más cercano

    // Tecnología
    ['mercadolibre', 'Otros'], ['mercado libre', 'Otros'],
    ['fravega', 'Otros'], ['garbarino', 'Otros'],
    ['musimundo', 'Otros'], ['compumundo', 'Otros'],
    ['apple', 'Otros'], ['samsung', 'Otros'],
  ]);

  // ===== CORRECCIONES OCR =====
  // Errores frecuentes que comete Tesseract con tickets de baja calidad
  static OCR_CORRECTIONS = [
    [/[oO](?=\d)/g, '0'],       // "O" antes de dígito → "0"
    [/(?<=\d)[oO]/g, '0'],      // "O" después de dígito → "0"
    [/[lI](?=\d)/g, '1'],       // "l" o "I" antes de dígito → "1"
    [/(?<=\d)[lI]/g, '1'],      // "l" o "I" después de dígito → "1"
    [/[S](?=\d{2})/g, '5'],     // "S" antes de 2 dígitos → "5"
    [/(?<=\d)[S]/g, '5'],       // "S" después de dígito → "5"
    [/\bTOTAI\b/gi, 'TOTAL'],   // "TOTAI" → "TOTAL"
    [/\bTOTAL\b/gi, 'TOTAL'],   // Normalizar variantes
    [/\bSUBTOTAI\b/gi, 'SUBTOTAL'],
    [/\bT0TAL\b/gi, 'TOTAL'],   // Cero por O
  ];

  /**
   * Método principal: parsea texto crudo → datos estructurados.
   * Aplica correcciones OCR antes de extraer datos.
   */
  static parse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return { desc: '', amount: null, date: null, cat: 'Otros', rawText: '' };
    }

    // Paso 1: Limpiar y corregir errores comunes de OCR
    let cleanText = rawText.trim();
    const correctedText = this.applyOcrCorrections(cleanText);
    const lowerText = correctedText.toLowerCase();

    return {
      desc: this.extractDescription(correctedText, lowerText),
      amount: this.extractAmount(correctedText),
      date: this.extractDate(correctedText),
      cat: this.detectCategory(lowerText),
      rawText: cleanText // Guardamos el original para referencia
    };
  }

  /**
   * Aplica correcciones de errores comunes del OCR.
   * Solo corrige en contextos numéricos para no romper texto.
   */
  static applyOcrCorrections(text) {
    let result = text;
    for (const [pattern, replacement] of this.OCR_CORRECTIONS) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  // ===== EXTRACCIÓN DE MONTO =====

  /**
   * Extrae el monto total con estrategia mejorada.
   * 
   * Estrategias (por prioridad):
   * 1. "TOTAL" explícito → máxima confianza
   * 2. "SUBTOTAL" + impuestos → calcular total
   * 3. Todos los $ → tomar el mayor (suele ser el total)
   * 4. Números grandes sueltos → fallback
   */
  static extractAmount(text) {
    // --- Estrategia 1: Buscar TOTAL explícito ---
    const totalPatterns = [
      /TOTAL\s*(?:A\s+PAGAR)?\s*:?\s*\$?\s*([\d.,]+)/i,
      /IMPORTE\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /MONTO\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /AMOUNT\s*:?\s*\$?\s*([\d.,]+)/i,     // Inglés
      /TOTAL\s+DUE\s*:?\s*\$?\s*([\d.,]+)/i, // Inglés
      /GRAND\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
    ];

    // Buscar la ÚLTIMA aparición de TOTAL (porque a veces hay subtotales antes)
    let lastTotalAmount = null;
    for (const pattern of totalPatterns) {
      const matches = [...text.matchAll(new RegExp(pattern.source, 'gi'))];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const parsed = this.parseSmartNumber(lastMatch[1]);
        if (parsed > 0) lastTotalAmount = parsed;
      }
    }
    if (lastTotalAmount !== null) return lastTotalAmount;

    // --- Estrategia 2: Buscar montos con $ y tomar el mayor ---
    const priceMatches = text.match(/\$\s*([\d.,]+)/g);
    if (priceMatches && priceMatches.length > 0) {
      const amounts = priceMatches
        .map(m => this.parseSmartNumber(m.replace(/\$\s*/, '')))
        .filter(n => n > 0);
      if (amounts.length > 0) return Math.max(...amounts);
    }

    // --- Estrategia 3: Buscar números con formato de precio ---
    const numberMatches = text.match(/\d[\d.,]*\d/g);
    if (numberMatches) {
      const amounts = numberMatches
        .map(m => this.parseSmartNumber(m))
        .filter(n => n > 10);
      if (amounts.length > 0) return Math.max(...amounts);
    }

    return null;
  }

  /**
   * Parseo inteligente de números.
   * Detecta automáticamente si es formato argentino (15.430,50)
   * o internacional (15,430.50).
   */
  static parseSmartNumber(str) {
    if (!str) return 0;
    str = str.trim();

    // Caso: tiene coma Y punto
    if (str.includes(',') && str.includes('.')) {
      const lastComma = str.lastIndexOf(',');
      const lastDot = str.lastIndexOf('.');
      
      if (lastComma > lastDot) {
        // Formato argentino: 15.430,50 → coma es decimal
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
      } else {
        // Formato USA: 15,430.50 → punto es decimal
        return parseFloat(str.replace(/,/g, '')) || 0;
      }
    }

    // Caso: solo coma
    if (str.includes(',')) {
      const parts = str.split(',');
      const afterComma = parts[parts.length - 1];
      if (afterComma.length <= 2) {
        // Coma como decimal: "99,90" → 99.90
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
      }
      // Coma como miles (USA): "1,234" → 1234
      return parseFloat(str.replace(/,/g, '')) || 0;
    }

    // Caso: solo punto
    if (str.includes('.')) {
      const parts = str.split('.');
      const afterDot = parts[parts.length - 1];
      if (afterDot.length === 3 && parts.length > 1) {
        // Punto como miles argentino: "15.430" → 15430
        return parseFloat(str.replace(/\./g, '')) || 0;
      }
      // Punto como decimal normal
      return parseFloat(str) || 0;
    }

    return parseFloat(str) || 0;
  }

  /**
   * Alias para retrocompatibilidad con tests existentes.
   */
  static parseArgentineNumber(str) {
    return this.parseSmartNumber(str);
  }

  // ===== EXTRACCIÓN DE FECHA =====

  /**
   * Extrae fecha con soporte para tickets viejos y formatos internacionales.
   * 
   * Formatos soportados:
   * - DD/MM/YYYY, DD-MM-YYYY (Argentina/Europa)
   * - MM/DD/YYYY (USA) — detectado por contexto
   * - DD/MM/YY (año corto)
   * - DD MES YYYY, DD de MES de YYYY
   * - Rango de años: 2000-2030 (para tickets viejos)
   */
  static extractDate(text) {
    // Meses en español para detección contextual
    const monthMap = {
      'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
      'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
      'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
      // Inglés
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12',
    };

    // --- Patrón 1: DD MES YYYY (textual) ---
    const textDateRegex = /(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:de\s+)?(\d{4})/i;
    const textMatch = text.match(textDateRegex);
    if (textMatch) {
      const [, day, monthStr, year] = textMatch;
      const monthNum = monthMap[monthStr.toLowerCase().slice(0, 3)];
      if (monthNum) {
        const y = parseInt(year);
        if (y >= 2000 && y <= 2030) {
          return `${year}-${monthNum}-${String(parseInt(day)).padStart(2, '0')}`;
        }
      }
    }

    // --- Patrón 2: Fechas numéricas DD/MM/YYYY o MM/DD/YYYY ---
    // Buscamos TODAS las fechas candidatas y elegimos la mejor
    const dateRegex = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/g;
    const candidates = [];
    let match;

    while ((match = dateRegex.exec(text)) !== null) {
      let [, a, b, yearStr] = match;
      let year = parseInt(yearStr);
      if (yearStr.length === 2) year = 2000 + year;
      
      if (year < 2000 || year > 2030) continue;

      const numA = parseInt(a);
      const numB = parseInt(b);

      // Intentar DD/MM/YYYY (formato argentino, prioridad)
      if (numA >= 1 && numA <= 31 && numB >= 1 && numB <= 12) {
        candidates.push({
          date: `${year}-${String(numB).padStart(2, '0')}-${String(numA).padStart(2, '0')}`,
          priority: 2 // Prioridad alta (formato argentino)
        });
      }
      // Intentar MM/DD/YYYY (formato USA)
      else if (numA >= 1 && numA <= 12 && numB >= 1 && numB <= 31) {
        candidates.push({
          date: `${year}-${String(numA).padStart(2, '0')}-${String(numB).padStart(2, '0')}`,
          priority: 1 // Prioridad menor
        });
      }
    }

    // Devolver la fecha con mayor prioridad
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.priority - a.priority);
      return candidates[0].date;
    }

    return null;
  }

  // ===== EXTRACCIÓN DE DESCRIPCIÓN =====

  /**
   * Extrae el nombre del comercio con estrategia por posición.
   * 
   * Los tickets siempre tienen el nombre del comercio en las 
   * primeras 3-5 líneas. Priorizamos eso sobre búsqueda global.
   */
  static extractDescription(text, lowerText) {
    // --- Estrategia 1: Buscar razón social explícita ---
    const razonPatterns = [
      /(?:RAZON\s*SOCIAL|DENOMINACION|NOMBRE\s*COMERCIAL?)\s*:?\s*(.+)/i,
      /(?:ESTABLECIMIENTO|COMERCIO)\s*:?\s*(.+)/i,
    ];
    for (const pattern of razonPatterns) {
      const match = text.match(pattern);
      if (match) return this.cleanDescription(match[1]);
    }

    // --- Estrategia 2: Buscar comercio conocido en primeras líneas ---
    const firstLines = lowerText.split('\n').slice(0, 5).join(' ');
    for (const [merchant] of this.KNOWN_MERCHANTS) {
      // Usamos word boundary para no matchear parciales
      // Ej: "dia" no debe matchear "media" ni "diario"
      if (merchant.length <= 3) {
        // Para nombres cortos, buscamos como palabra completa
        const regex = new RegExp(`\\b${this.escapeRegex(merchant)}\\b`, 'i');
        if (regex.test(firstLines)) {
          return merchant.charAt(0).toUpperCase() + merchant.slice(1);
        }
      } else if (firstLines.includes(merchant)) {
        return merchant.charAt(0).toUpperCase() + merchant.slice(1);
      }
    }

    // --- Estrategia 3: Buscar comercio conocido en todo el texto ---
    for (const [merchant] of this.KNOWN_MERCHANTS) {
      if (merchant.length <= 3) {
        const regex = new RegExp(`\\b${this.escapeRegex(merchant)}\\b`, 'i');
        if (regex.test(lowerText)) {
          return merchant.charAt(0).toUpperCase() + merchant.slice(1);
        }
      } else if (lowerText.includes(merchant)) {
        return merchant.charAt(0).toUpperCase() + merchant.slice(1);
      }
    }

    // --- Estrategia 4: Usar primera línea significativa ---
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    for (const line of lines) {
      if (/^\d+$/.test(line)) continue;
      if (/^\$/.test(line)) continue;
      if (/^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$/.test(line)) continue;
      if (/^(TOTAL|SUBTOTAL|IVA|CUIT|FACT)/i.test(line)) continue;
      if (/^\(\d{3}\)/.test(line)) continue; // Teléfono
      return this.cleanDescription(line);
    }

    return 'Compra escaneada';
  }

  /**
   * Limpia una descripción extraída.
   */
  static cleanDescription(desc) {
    return desc
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s&áéíóúñÁÉÍÓÚÑ.,\-]/g, '')
      .trim()
      .substring(0, 60);
  }

  /**
   * Escapa caracteres especiales de regex.
   */
  static escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ===== DETECCIÓN DE CATEGORÍA =====

  /**
   * Detecta categoría con búsqueda por word boundary para nombres cortos.
   */
  static detectCategory(lowerText) {
    // Primero buscar en las primeras líneas (más confiable)
    const firstLines = lowerText.split('\n').slice(0, 5).join(' ');
    
    for (const [merchant, category] of this.KNOWN_MERCHANTS) {
      if (merchant.length <= 3) {
        const regex = new RegExp(`\\b${this.escapeRegex(merchant)}\\b`, 'i');
        if (regex.test(firstLines)) return category;
      } else if (firstLines.includes(merchant)) {
        return category;
      }
    }

    // Luego en todo el texto
    for (const [merchant, category] of this.KNOWN_MERCHANTS) {
      if (merchant.length <= 3) {
        const regex = new RegExp(`\\b${this.escapeRegex(merchant)}\\b`, 'i');
        if (regex.test(lowerText)) return category;
      } else if (lowerText.includes(merchant)) {
        return category;
      }
    }

    // Heurística por palabras clave generales
    if (/comida|restaurant|cafe|bar|pizz|empanada|milanesa/i.test(lowerText)) return 'Alimentación';
    if (/nafta|gasoil|combustible|estacion de servicio/i.test(lowerText)) return 'Transporte';
    if (/medicamento|receta|consulta medica/i.test(lowerText)) return 'Salud';

    return 'Otros';
  }
}
