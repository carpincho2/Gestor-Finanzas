# 🎯 INICIO AQUÍ — Guía de Documentación y Plan de Mejora OCR

¡Hola! Como estudiante, aprender a documentar y estructurar el conocimiento de un proyecto es tan importante como escribir el código. Este archivo es tu **punto de partida** para comprender la arquitectura de la aplicación y la mejora del sistema de reconocimiento óptico de caracteres (OCR) de tickets, así como la integración con plataformas de pago.

---

## 📋 El Problema y la Solución

### El Desafío Original
> *"Quiero 100% de fiabilidad que lo que va a poner el OCR sea 100% confiable y no que en el nombre ponga '24nfwiaji'."*

### Nuestra Solución
Implementamos una estrategia de **Validación Multi-Nivel y Normalización de Datos** que filtra los textos confusos generados por el OCR (Tesseract.js) y los contrasta con un diccionario inteligente local. Esto previene que se ingresen registros corruptos o incomprensibles en tu base de datos SQLite.

---

## 📂 Guía de Archivos Activos (mds/)

Hemos simplificado la carpeta `mds/` eliminando resúmenes redundantes e índices antiguos. A continuación, tienes el mapa de los **8 archivos fundamentales** que realmente sirven para el proyecto:

| Archivo | ¿Qué contiene? | ¿Cuándo leerlo? |
| :--- | :--- | :--- |
| 📁 [organizacion.md](organizacion.md) | La estructura completa de directorios del proyecto y por qué se dividió el Frontend del Backend. | Al inicio, para entender cómo interactúan los archivos. |
| 💡 [OCR_IMPROVEMENT_PLAN.md](OCR_IMPROVEMENT_PLAN.md) | Plan técnico completo con los conceptos y algoritmos detrás de la mejora del OCR (Fuzzy Matching, distancia Levenshtein). | Para comprender la teoría académica y lógica del procesamiento de texto. |
| 🚀 [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) | Guía paso a paso sobre cómo y dónde insertar el código de validación de OCR en tu archivo de script principal. | Cuando vayas a programar e implementar las mejoras en `js/app.js`. |
| 🛠️ [OCR_IMPLEMENTATION_EXAMPLES.js](OCR_IMPLEMENTATION_EXAMPLES.js) | Ejemplos prácticos y código JavaScript real de las funciones de validación (CUIT, montos, fechas, nombres). | Para copiar y adaptar funciones de validación de texto directamente en tu código. |
| 🧪 [OCR_TEST_CASES.js](OCR_TEST_CASES.js) | Suite de pruebas automatizadas que puedes ejecutar en la consola del navegador para validar tus funciones. | Para comprobar de forma interactiva si tu validador de OCR funciona correctamente. |
| 🗄️ [OCR_PATTERNS.json](OCR_PATTERNS.json) | Diccionario de patrones global con marcas multinacionales, categorías multilingües y configuraciones de validación mundial. | Para expandir o personalizar las marcas y categorías que el OCR reconoce automáticamente. |
| 💳 [investigacion_mp.md](investigacion_mp.md) | Investigación técnica y guía de integración específica con la API de Mercado Pago para Argentina y Latinoamérica. | Si deseas conectar y sincronizar tus gastos de la cuenta de MP en tu país. |
| 🌍 [investigacion_multinacional_pagos.md](investigacion_multinacional_pagos.md) | Arquitectura multiproveedor global y APIs de Open Banking (Plaid, Belvo, Fintoc, PSD2) para la importación internacional de transacciones. | Para entender cómo coexisten Mercado Pago y otras plataformas financieras a nivel mundial. |

---

## ⚡ Formas de Iniciar el Aprendizaje

### 1️⃣ Método de Depuración Rápido (5 minutos)
Puedes ver qué procesa internamente el OCR sin cambiar nada del código del frontend:
1. Abre tu aplicación en el navegador.
2. Abre la consola de desarrollador presionando **F12** (o clic derecho -> Inspeccionar -> pestaña Consola).
3. Escribe y ejecuta el siguiente comando:
   ```javascript
   localStorage.setItem('ocr_debug_enabled', '1');
   location.reload();
   ```
4. Intenta escanear un ticket. En la consola verás impreso paso a paso el texto detectado y los errores identificados.

### 2️⃣ Método de Implementación (1 hora)
Si quieres implementar la validación inteligente del OCR para asegurar que no entren nombres inválidos como `"24nfwiaji"`:
1. Lee [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) para comprender la secuencia lógica de cambios.
2. Copia y adapta el código de validaciones de [OCR_IMPLEMENTATION_EXAMPLES.js](OCR_IMPLEMENTATION_EXAMPLES.js) en tu archivo [js/app.js](../js/app.js).
3. Prueba la suite de validación copiando y pegando el código de [OCR_TEST_CASES.js](OCR_TEST_CASES.js) en la consola (DevTools) y ejecutando `runOCRTestSuite()`.

---

## 🎓 Conceptos Clave para Estudiar

Como estudiante de desarrollo de software, presta especial atención a estos temas dentro de la documentación:

*   **Fuzzy Matching (Búsqueda difusa)**: Técnica matemática para encontrar textos que son "similares" aunque no idénticos. Útil para corregir `"Carrefur"` a `"Carrefour"`. (Ver [OCR_IMPROVEMENT_PLAN.md](OCR_IMPROVEMENT_PLAN.md)).
*   **Separación de Responsabilidades**: Por qué decidimos separar la autenticación (`index.html` + `js/auth.js`) de la pantalla interna del dashboard (`main.html` + `js/app.js`). (Ver [organizacion.md](organizacion.md)).
*   **Integración de APIs Externas (Finanzas Locales e Internacionales)**: Cómo funciona el flujo OAuth2 y las APIs de Open Banking (Plaid, Belvo, Fintoc) para importar movimientos bancarios y de Mercado Pago de manera unificada y automática. (Ver [investigacion_mp.md](investigacion_mp.md) e [investigacion_multinacional_pagos.md](investigacion_multinacional_pagos.md)).
*   **Despliegue en la Nube e Infraestructura como Código**: Cómo usar el manifiesto [render.yaml](../render.yaml) para configurar y conectar automáticamente una base de datos PostgreSQL de producción y un servidor web Python (FastAPI) en la nube sin configuraciones manuales.

---

v2.0 | Junio de 2026 | Documentación Optimizada y Depurada
