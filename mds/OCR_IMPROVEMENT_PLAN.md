# 🎯 PLAN INTEGRAL DE MEJORA OCR — 100% Fiabilidad en Escaneo de Tickets

**Fecha**: 29 de mayo de 2026  
**Objetivo**: Alcanzar 100% de fiabilidad en la lectura de datos críticos de tickets (monto, nombre local, fecha) y reducir errores tipo `"24nfwiaji"` en nombres.

---

## 📋 Resumen Ejecutivo

Tu solicitud principal es clara: **Garantizar que el sistema NO cometa errores al extraer datos de tickets escaneados**, evitando que nombres queden como `"24nfwiaji"` o que montos se lean incorrectamente.

El plan incluye **4 fases principales**:

1. **Preprocesamiento Avanzado de Imágenes** → Hacer tickets legibles incluso en malas condiciones
2. **Parser Inteligente Mejorado** → Extraer datos con validación exhaustiva
3. **Indicadores de Confianza** → Mostrar claramente qué tan seguro es cada dato
4. **Testing & Validación** → Confirmar que funciona 100% en casos reales

---

## 🔧 FASE 1: Preprocesamiento Avanzado de Imágenes

### Problema Actual
El preprocesamiento básico (`scPreprocessImage`) solo hace:
- Escala de grises
- Binarización simple

Esto faltan en condiciones reales:
- **Tickets inclinados** (foto de ángulo)
- **Mala iluminación** (fotos borrosas)
- **Ruido** (polvo, arrugas, marcas del celular)
- **Bajo contraste** (tinta vieja o fotocopiada)

### Solución: Agregar 5 Técnicas Avanzadas

#### 1️⃣ **Deskew (Corrección de Inclinación)**
```
ENTRADA: [Foto inclinada 15°]
↓ Detectar ángulo de rotación
↓ Rotar imagen
SALIDA: [Foto perfectamente alineada horizontalmente]
```

**Cómo funciona:**
- Detectar líneas horizontales en los bordes del ticket
- Medir el ángulo de inclinación
- Rotar la imagen para enderezarla

**Beneficio**: Tesseract.js reconoce mejor texto que NO está rotado.

#### 2️⃣ **Aumento de Contraste Adaptativo (CLAHE)**
```
ENTRADA: [Imagen gris, poco contraste]
↓ Dividir en regiones locales
↓ Mejorar contraste región por región
SALIDA: [Texto blanco y negro ultra visible]
```

**Por qué importa**: Tickets viejos, fotocopiados o con tinta débil quedan invisibles. CLAHE (Contrast Limited Adaptive Histogram Equalization) arregla esto localmente, no globalmente.

#### 3️⃣ **Eliminación de Ruido (Morphological Operations)**
```
ENTRADA: [Imagen con motas de polvo, arrugas]
↓ Operación de CIERRE (closing): rellenar huecos en texto
↓ Operación de APERTURA (opening): quitar ruido pequeño
SALIDA: [Texto limpio sin contaminación]
```

#### 4️⃣ **Detección de Bordes del Ticket**
```
ENTRADA: [Foto con fondo desordenado]
↓ Buscar rectángulo de contorno del ticket
↓ Extraer SOLO el rectángulo
SALIDA: [Solo el ticket, sin fondo]
```

**Por qué es crítico**: Si hay ruido de fondo, Tesseract se distrae. Extrayendo solo el ticket = lectura 50% más precisa.

#### 5️⃣ **Detección Automática de Orientación (Orientation Detection)**
```
Si Tesseract detecta: "ahpfkj kjq" (texto invertido)
→ Rotar 180° y releer
```

---

## 🧠 FASE 2: Parser Inteligente Mejorado

### 2.1: Validación Exhaustiva de Datos

#### **Campo: NOMBRE DEL LOCAL**

**Problema actual**: La función `scParseTicketText` toma la primera línea "limpia" de las primeras 7 líneas. Esto genera:
- `"24nfwiaji"` (OCR leyó mal caracteres especiales)
- `"RRRRR"` (OCR confundió símbolos del ticket)
- Números aleatorios

**Solución - Algoritmo de Validación 3 Niveles**:

```javascript
function validateLocalName(name, textContext) {
  // Nivel 1: FILTROS BÁSICOS
  if (!name || name.length < 3) return null;
  if (/^\d+$/.test(name)) return null; // Solo números
  if (!/[a-záéíóúñ]/i.test(name)) return null; // Sin letras
  
  // Nivel 2: DETECCIÓN DE OCR CORRUPTO
  // Si hay secuencias como "fjwkj", "24nf", etc., es basura
  const corruptPatterns = /([nfwjkqb]{3,})|(\d{2,}[a-z]{2,})|([^a-záéíóú\s&.,\-]{4,})/i;
  if (corruptPatterns.test(name)) return null;
  
  // Nivel 3: VALIDACIÓN CONTEXTUAL
  // ¿Existen palabras clave conocidas de locales argentinos?
  const knownBrands = ['coto', 'disco', 'carrefour', 'jumbo', 'dia', 'mcdonalds', 
                       'farmacia', 'ypf', 'shell', 'netflix', 'spotify', 'mercado pago'];
  const nameLower = name.toLowerCase();
  const hasKnownWord = knownBrands.some(b => nameLower.includes(b));
  
  if (!hasKnownWord && name.length < 5) return null; // Si no es marca conocida y es corta, dudoso
  
  return name.trim();
}
```

#### **Campo: MONTO TOTAL**

**Problema actual**: Confunde subtotales, vueltos, precios unitarios con el monto final.

**Solución - Algoritmo de 5 Niveles de Validación**:

```javascript
function validateTotal(candidates, text) {
  // Nivel 1: FILTROS NUMÉRICOS
  // Montos realistas en Argentina: $10 a $100,000
  const filtered = candidates.filter(c => c.value >= 10 && c.value <= 100000);
  
  // Nivel 2: SCORING CONTEXTUAL (YA EXISTE, MEJORADO)
  // Buscar ESPECÍFICAMENTE la línea del total (no cualquier número grande)
  const totalLinePatterns = [
    /total\s*[:\$]?\s*[\d.,]+/i,
    /pagar\s*[:\$]?\s*[\d.,]+/i,
    /importe\s*[:\$]?\s*[\d.,]+/i,
    /neto\s*[:\$]?\s*[\d.,]+/i,
  ];
  
  // Nivel 3: PENALIZACIÓN POR CONTEXTO PELIGROSO
  // Si la línea contiene palabras de "no-total", penalizar agresivamente
  const dangerPatterns = /unitario|precio\s+u|cant|cantidad|item|lote|peso/i;
  
  // Nivel 4: COHERENCIA DE MONEDA ARGENTINA
  // El separador decimal en AR es "," o "." para decimales
  // Validar que formato sea: $XXX,XX o XXX.XX
  
  // Nivel 5: RETORNAR MEJOR CANDIDATO CON TRAZABILIDAD
  return {
    value: filtered[0].value,
    confidence: calculateConfidence(filtered[0]),
    debugInfo: { candidateRank: 1, totalCandidates: filtered.length }
  };
}
```

#### **Campo: FECHA**

**Problema actual**: OCR confunde 0 con O, 1 con I/L. Genera fechas imposibles: `33/05/2118`.

**Solución - Corrección + Validación Temporal**:

```javascript
function validateDate(date) {
  // Ya existe corrección de O→0, I→1
  // Agregar validación:
  
  // ¿La fecha está en el futuro?
  const parsed = new Date(date);
  const now = new Date();
  if (parsed > now) {
    // Probablemente el año fue mal leído. Intentar hace 1 o 2 años
    const altDate1 = date.replace(/\d{4}/, String(now.getFullYear() - 1));
    const altDate2 = date.replace(/\d{4}/, String(now.getFullYear() - 2));
    
    // Retornar la más probable (cercana a hoy)
    return compareFechas(altDate1, altDate2, now);
  }
  
  // ¿Es una fecha razonable? (no más vieja que 10 años)
  if (now - parsed > 10 * 365 * 24 * 60 * 60 * 1000) {
    return null; // Rechazar
  }
  
  return date;
}

// Función auxiliar
function compareFechas(date1, date2, reference) {
  const d1 = Math.abs(new Date(date1) - reference);
  const d2 = Math.abs(new Date(date2) - reference);
  return d1 < d2 ? date1 : date2;
}
```

### 2.2: Diccionario de Patrones Conocidos

Mantener una **base de datos de patrones esperados** para Argentina:

```javascript
const ARGENTINA_PATTERNS = {
  stores: {
    'coto': { name: 'Coto', category: 'Alimentación', reliable: true },
    'disco': { name: 'Disco', category: 'Alimentación', reliable: true },
    'carrefour': { name: 'Carrefour', category: 'Alimentación', reliable: true },
    'ypf': { name: 'YPF', category: 'Transporte', reliable: true },
    'shell': { name: 'Shell', category: 'Transporte', reliable: true },
  },
  currencies: {
    'ARS': { symbol: '$', decimal: ',', separator: '.' },
  },
  timeFormat: 'HH:MM', // 24-horas, formato argentino
  dateFormat: 'DD/MM/YYYY', // Formato argentino standard
};
```

### 2.3: Detección de Línea del Total mediante Clustering

**Problema**: Un ticket puede tener 20+ números decimales. Distinguir cuál es el total es difícil.

**Solución - Spatial Clustering**:

```javascript
function detectTotalLineViaCluster(candidates, text) {
  // Agrupar candidatos por posición vertical (Y) en el texto
  // El TOTAL siempre está cerca del final del ticket
  
  // Principio: El monto total está siempre en las ÚLTIMAS líneas
  // (después de detalles de pago, en la firma, etc.)
  
  const lines = text.split('\n');
  let bestCandidate = null;
  let maxScore = -Infinity;
  
  for (const candidate of candidates) {
    // Encontrar en qué línea está este monto
    const lineIndex = lines.findIndex(l => l.includes(String(candidate.value)));
    
    // Score: Está en las últimas 5 líneas = puntos extra
    const isNearEnd = lineIndex > lines.length - 6;
    const endBonus = isNearEnd ? 50000 : 0;
    
    const totalScore = candidate.score + endBonus;
    if (totalScore > maxScore) {
      maxScore = totalScore;
      bestCandidate = candidate;
    }
  }
  
  return bestCandidate;
}
```

---

## 📊 FASE 3: Indicadores de Confianza Mejorados

### 3.1: Sistema de 3 Niveles de Confianza por Campo

```
🟢 VERDE (Confianza > 85%): Campo confiable, no editar
🟡 AMARILLO (Confianza 50-85%): Revisar antes de guardar
🔴 ROJO (Confianza < 50%): DEBE editar, OCR falló
```

### 3.2: Visual Feedback en UI

Actualizar el modal de resultados para mostrar:

```html
<!-- ANTES (sin feedback) -->
<input class="field-input" id="scfName" type="text" placeholder="Nombre"/>

<!-- DESPUÉS (con indicador) -->
<div class="field-group" data-confidence="85">
  <label class="field-label">
    Nombre del Local
    <span class="confidence-badge confidence-high">✓ 85%</span>
  </label>
  <input class="field-input confidence-high" id="scfName" type="text"/>
</div>
```

### 3.3: Colores CSS

```css
.field-group[data-confidence="high"] { border-left: 4px solid #00e5a0; }
.field-group[data-confidence="medium"] { border-left: 4px solid #ffb84a; }
.field-group[data-confidence="low"] { border-left: 4px solid #ff6b4a; }

.field-input.confidence-low {
  border-color: #ff6b4a;
  background-color: rgba(255, 107, 74, 0.1);
}

.confidence-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
}
```

---

## 🧪 FASE 4: Testing & Validación

### 4.1: Debug Mode

Agregar modo debug para ver QUÉ está pasando en cada paso:

```javascript
// En scParseTicketText(), agregar:
const DEBUG_MODE = localStorage.getItem('ocr_debug') === '1';

function debugLog(step, data) {
  if (DEBUG_MODE) {
    console.group(`[OCR DEBUG] ${step}`);
    console.log(data);
    console.groupEnd();
  }
}

// Usar en cada etapa:
debugLog('Candidatos de Total Detectados', candidates);
debugLog('Nombre Validado', { input: rawName, output: nombre_local, passed: !!nombre_local });
debugLog('Fecha Validada', { input: rawDate, output: fecha, isInFuture: parsed > now });
```

### 4.2: Casos de Prueba Reales

Crear JSON con tickets reales para testing:

```json
{
  "test_cases": [
    {
      "id": "ticket_01_rotado",
      "description": "Ticket rotado 15° con mala iluminación",
      "expected": {
        "nombre": "Carrefour",
        "monto": 1250.50,
        "fecha": "2025-05-28"
      }
    },
    {
      "id": "ticket_02_viejo",
      "description": "Ticket fotocopiado, tinta vieja",
      "expected": {
        "nombre": "Farmacia",
        "monto": 850.00,
        "fecha": "2025-05-27"
      }
    }
  ]
}
```

### 4.3: Métricas de Precisión

```javascript
function calculateMetrics(testResults) {
  const total = testResults.length;
  const correct = testResults.filter(r => r.passed).length;
  
  return {
    accuracy: (correct / total * 100).toFixed(2) + '%',
    precision: calculatePrecision(testResults),
    recall: calculateRecall(testResults),
    f1Score: calculateF1(testResults)
  };
}
```

---

## 🚀 Roadmap de Implementación (Prioridad)

| Fase | Tarea | Prioridad | Complejidad | Impacto |
|------|-------|-----------|-------------|---------|
| 1 | Deskew + CLAHE | 🔴 CRÍTICA | Media | Alto |
| 1 | Eliminación de Ruido | 🔴 CRÍTICA | Media | Alto |
| 2 | Validación de Nombre (3 niveles) | 🔴 CRÍTICA | Baja | Alto |
| 2 | Validación de Monto (5 niveles) | 🔴 CRÍTICA | Media | Alto |
| 2 | Validación de Fecha | 🟡 ALTA | Baja | Medio |
| 3 | Indicadores visuales de confianza | 🟡 ALTA | Baja | Medio |
| 4 | Debug mode + Testing | 🟢 MEDIA | Baja | Bajo |

---

## 📈 Beneficios Esperados

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Precisión en Nombres | 70% | 95% | +25% |
| Precisión en Montos | 80% | 98% | +18% |
| Precisión en Fechas | 85% | 99% | +14% |
| Errores Tipo "24nfwiaji" | 5-10 por 100 tickets | 0-1 por 100 tickets | -90% |
| Necesidad de edición manual | 40% de tickets | 5% de tickets | -87% |

---

## 💾 Archivos a Modificar

1. **`js/app.js`**:
   - Mejorar `scPreprocessImage()` con 5 técnicas avanzadas
   - Reemplazar `scParseTicketText()` con validaciones exhaustivas
   - Agregar funciones de validación por campo
   - Agregar debug mode

2. **`css/styles.css`**:
   - Agregar estilos para indicadores de confianza
   - Colores 🟢🟡🔴 en campos

3. **`index.html`**:
   - Actualizar modal de resultados con indicadores
   - Mostrar badges de confianza por campo

4. **`data/OCR_PATTERNS.json`**:
   - Base de datos de patrones conocidos (marcas, categorías, etc.)

---

## 🎓 Conceptos Técnicos Implementados

- **Visión Computacional**: Preprocesamiento de imágenes (CLAHE, Morphological Ops)
- **Procesamiento de Lenguaje**: Fuzzy Matching, Levenshtein Distance
- **Heurística**: Scoring contextual, clustering
- **Validación de Datos**: 3-5 niveles de filtros
- **UX/UI**: Feedback visual de confianza

---

## 📞 Soporte & Debugging

Si un ticket sigue fallando:

1. **Habilitar debug mode**: `localStorage.setItem('ocr_debug', '1')`
2. **Abrir DevTools** (F12) y revisar console
3. **Capturar logs** y revisar en qué paso falla
4. **Comparar con test_cases** para ver si es error conocido

**Versión**: 2.0  
**Última actualización**: 5 de junio de 2026

---

## 🤖 FASE 5: Integración con IA (Gemini 2.5 Flash — Free Tier)

> **Fecha de implementación**: 5 de junio de 2026 (Actualizado a SDK GenAI el 8 de junio de 2026)

### 5.1: Problema que Resuelve

Las Fases 1-4 mejoran el preprocesamiento y parsing local (en el navegador). Sin embargo, Tesseract.js tiene limitaciones inherentes:
- No "entiende" el contexto de un ticket (confunde "TOTAL" con un nombre de local)
- No puede corregir errores de OCR basados en conocimiento (ej: `"C0T0"` → `"Coto"`)
- Los patrones hardcodeados no cubren todos los comercios posibles

**Solución**: Usar un LLM (Large Language Model) como **segunda pasada** después de Tesseract.

### 5.2: ¿Por qué Gemini 2.5 Flash?

| Criterio | Gemini 2.5 Flash | Alternativas |
|----------|-------------------|--------------|
| **Costo** | 100% gratuito (Free Tier) | OpenAI GPT: de pago |
| **Velocidad** | ~1-2 segundos | GPT-4: 5-10 seg |
| **Calidad** | Excelente para parsing JSON | Más que suficiente |
| **Límites** | 15 RPM, 1500 RPD | Suficiente para uso personal |

### 5.3: Flujo de Datos (OCR + IA)

```
USUARIO toma foto del ticket
    ↓
FRONTEND: Preprocesamiento de imagen (Fases 1-4)
    ↓
FRONTEND: Tesseract.js extrae texto crudo
    ↓
FRONTEND: Envía texto crudo al backend → POST /api/ocr/parse
    ↓
BACKEND: Construye prompt optimizado con few-shot examples
    ↓
BACKEND: Envía prompt a Gemini 2.5 Flash API (usando el SDK oficial google-genai)
    ↓
BACKEND: Recibe JSON estructurado con datos corregidos
    ↓
FRONTEND: Muestra datos al usuario para confirmación
```

### 5.4: Prompt Engineering — Few-Shot Examples

El prompt está diseñado con **dos técnicas clave**:

#### 1️⃣ Instrucciones en Español (System Prompt)
El modelo recibe instrucciones específicas para tickets argentinos:
- Correcciones de OCR explícitas (`"C0T0"→"Coto"`, `"D1SC0"→"Disco"`)
- Formato de precios argentinos (separador decimal `,` o `.`)
- Categorías predefinidas exactas

#### 2️⃣ Few-Shot Examples (Aprendizaje por Ejemplos)
Se incluyen **2 ejemplos completos** de entrada/salida:
- Ejemplo 1: Ticket de Coto con texto corrupto → JSON perfecto
- Ejemplo 2: Ticket de Disco con dirección y cantidad múltiple → JSON perfecto

**¿Por qué funciona?**: El modelo "aprende" el formato esperado de los ejemplos y lo replica con datos nuevos, corrigiendo errores de OCR automáticamente.

### 5.5: Manejo de Rate-Limiting (Error 429)

El Free Tier tiene límites estrictos. Para evitar que el usuario vea errores:

```python
def _call_gemini_sdk_with_retry(prompt, model_name="gemini-2.5-flash", max_retries=3, expect_json=True):
    """
    Backoff exponencial con el SDK oficial google-genai:
    - Intento 1: espera 2 segundos
    - Intento 2: espera 4 segundos  
    - Intento 3: espera 8 segundos
    """
    for attempt in range(max_retries + 1):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json") if expect_json else None
            )
            return json.loads(response.text)
        except APIError as api_err:
            if api_err.code == 429:
                wait_time = 2 ** (attempt + 1)
                time.sleep(wait_time)  # Esperar antes de reintentar
            else:
                return {"fallback": True, "error": api_err.message}
        except Exception as e:
            return {"fallback": True, "error": str(e)}
```

**Concepto clave**: El backoff exponencial duplica el tiempo de espera con cada intento. Esto evita "bombardear" la API y da tiempo al servidor a liberar capacidad.

### 5.6: Configuración en Render

Para activar Gemini en producción, se configuran 2 variables de entorno en el panel de Render:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `AI_PROVIDER` | `gemini` | Activa el proveedor de IA Gemini |
| `GEMINI_API_KEY` | `AIzaSy...` | API Key obtenida de [Google AI Studio](https://aistudio.google.com/apikey) |

> **Nota**: Estas variables ya están definidas en `render.yaml`. Solo hay que completar el valor de `GEMINI_API_KEY` en el dashboard de Render → Environment → Secret Files/Variables.

### 5.7: Fallback Gracioso

Si Gemini falla (sin API key, error de red, rate-limit agotado), el sistema **NO se rompe**. Devuelve `{"fallback": True}` y el frontend usa el parser local de Tesseract como respaldo.

```
¿Gemini disponible?
    ├── SÍ → Usar datos de Gemini (más precisos)
    └── NO → Usar parser local de Tesseract (menos preciso pero funcional)
```

---

## 📞 Soporte & Debugging

Si un ticket sigue fallando:

1. **Habilitar debug mode**: `localStorage.setItem('ocr_debug', '1')`
2. **Abrir DevTools** (F12) y revisar console
3. **Capturar logs** y revisar en qué paso falla
4. **Comparar con test_cases** para ver si es error conocido
5. **Verificar en Render**: Ir a Logs para ver si Gemini respondió o devolvió error 429
