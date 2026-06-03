# OCR — Escaneo de Tickets con Tesseract.js (v2)

## ¿Qué es OCR?
**O**ptical **C**haracter **R**ecognition. Tecnología que "lee" texto dentro de imágenes.
Tomamos una foto de un ticket → extraemos monto, fecha, comercio y categoría automáticamente.

## Motor: Tesseract.js v5
- Corre 100% en el navegador (sin servidor)
- Soporta español e inglés
- Web Workers (no bloquea la UI)
- ~2MB para el modelo de idioma

## Arquitectura Hexagonal

```
📦 Dominio
└── ReceiptParser.js     → Parser v2: 70+ comercios, formatos ARG/USA, tickets viejos

📦 Aplicación
├── OcrPort.js           → Contrato del motor OCR
└── ScanReceiptUseCase.js → Orquesta: imagen → OCR → parser → resultado

📦 Infraestructura
└── TesseractOcrAdapter.js → Implementación con Tesseract.js + Web Workers

📦 UI
└── OcrUIAdapter.js      → Modal drag&drop, cámara, progreso, edición

📦 Shared
└── ImagePreprocessor.js → Grises, contraste, binarización
```

## ReceiptParser v2 — Mejoras

### Parseo Inteligente de Números (`parseSmartNumber`)
Detecta automáticamente el formato:
- **Argentino:** `$15.430,50` → punto=miles, coma=decimal
- **Internacional:** `$15,430.50` → coma=miles, punto=decimal
- **Simple:** `29303.25` → punto=decimal

La clave: si tiene COMA y PUNTO, el que está más a la derecha es el decimal.

### Corrección de Errores OCR
Los tickets argentinos son de calidad horrible (impresoras térmicas baratas). Tesseract confunde:
- `O` ↔ `0` (la letra O con el número cero)
- `l` / `I` ↔ `1` (ele minúscula / i mayúscula con uno)
- `S` ↔ `5`
- `TOTAI` → `TOTAL`

### Fechas (rango 2000-2030)
Soporta tickets viejos y múltiples formatos:
- `DD/MM/YYYY` (Argentina) — prioridad alta
- `MM/DD/YYYY` (USA) — prioridad baja
- `DD-MM-YYYY`, `D/M/YY`
- `28 ABR 2025`, `28 de abril de 2025`
- Meses en español e inglés

### Detección de Comercio por Posición
Los tickets SIEMPRE tienen el nombre del comercio en las primeras 3-5 líneas.
El parser busca primero ahí, evitando falsos positivos con texto de más abajo.

### Word Boundary para Nombres Cortos
"Dia" (supermercado) no debe matchear "media" ni "diario".
Para comercios de ≤3 letras usamos `\bdia\b` (busca la palabra completa).

### 70+ Comercios Argentinos
Supermercados, farmacias, estaciones de servicio, apps de delivery, servicios, ropa, entretenimiento, y marcas internacionales.

## Tests
```bash
# En la consola del navegador:
import('./tests/runTests.js').then(m => m.runTests());
```

Cubren: formatos ARG/USA, tickets viejos (2009), ticket Tiffany, word boundary, inputs vacíos.
