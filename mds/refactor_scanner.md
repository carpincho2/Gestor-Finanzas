# Refactorización de Scanner (SOLID y SRP)

## Resumen

Se ha refactorizado el archivo `js/scanner.js` (que contaba con más de 1300 líneas) para adherirse a los principios SOLID, en particular al de Responsabilidad Única (SRP - Single Responsibility Principle). 

Anteriormente, el archivo mezclaba:
1. Manipulación del DOM y renderizado de la UI.
2. Control de hardware (cámara, flujos de video, captura de frames en canvas).
3. Lógica de negocio pesada para OCR, preprocesamiento de imágenes, expresiones regulares complejas, parsing de tickets y llamadas a la API.

## Cambios realizados

### 1. `js/services/cameraService.js`
Se extrajo toda la lógica relacionada con el manejo de la cámara y el streaming de video a una nueva clase de servicio `CameraService`.
- **Funcionalidad:** Solicita permisos de usuario, inicializa el stream de la cámara, detiene la captura y permite extraer un frame del `<video>` a un elemento `<canvas>` para generar una URL de datos (Data URL).
- **SRP:** Se ocupa exclusivamente de la manipulación del hardware/stream multimedia, dejando fuera cualquier lógica de análisis o UI.

### 2. `js/services/scannerService.js` (Servicio OCR / API)
Toda la lógica de análisis, preprocesamiento de imágenes, OCR (Tesseract.js) y parsing de datos de los tickets fue extraída a `scannerService.js`.
- **Funcionalidad:** 
  - Manejo del Worker persistente de Tesseract.
  - Preprocesamiento de imágenes (escala de grises, Otsu threshold, deskewing).
  - Parsing de los resultados devueltos por el OCR utilizando expresiones regulares, algoritmos de distancia de Levenshtein y matching difuso.
  - Generación de reportes de confianza y guardado de patrones "aprendidos" en localStorage.
  - Llamadas a la IA/API para un análisis profundo o secundario.
- **SRP:** Contiene puramente la lógica de procesamiento de datos e inferencia. No sabe de qué manera estos datos se muestran en pantalla.

### 3. `js/scanner.js`
Se ha sobrescrito el archivo original, reduciendo drásticamente su tamaño.
- **Funcionalidad:** Ahora funciona exclusivamente como un "Controlador de Vista" (View Controller). 
- **SRP:** Se ocupa de enlazar los eventos del usuario (clicks, drag & drop) a los servicios correspondientes (`cameraService`, `scannerService`), y de tomar los resultados para actualizar la interfaz (mostrar modals, loaders, historial, etc).

## Beneficios de la arquitectura actual

- **Mantenibilidad:** Ahora se pueden realizar cambios en el algoritmo de OCR o parsing sin miedo a romper la interfaz de usuario.
- **Reusabilidad:** Si en el futuro se necesita hacer un escaneo desde otra pantalla, el servicio `scannerService` y `cameraService` pueden ser reutilizados fácilmente.
- **Testabilidad:** Al estar la lógica separada del DOM, se vuelve mucho más sencillo crear pruebas unitarias para el algoritmo del OCR o el parseador de montos sin necesitar un navegador completo.
