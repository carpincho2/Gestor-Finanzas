# Arquitectura Hexagonal - Flujo

Hemos implementado el patrón de **Arquitectura Hexagonal** (Puertos y Adaptadores) para asegurar que el núcleo de la aplicación sea independiente de las herramientas externas.

## 1. Capa de Dominio (`src/domain/`)
Es el corazón del sistema. Contiene las entidades (`Transaction.js`, `Account.js`, `Budget.js`) que definen las reglas del negocio y el servicio `FinanceCalculator.js` para cálculos financieros. También incluye `ReceiptParser.js`, que contiene la lógica pura de parseo de tickets (extracción de montos, fechas, categorías). No sabe nada de la interfaz web ni de cómo se guardan los datos.

## 2. Capa de Aplicación (`src/application/`)
Contiene los **Casos de Uso** (`usecases/`) y los **Puertos** (`ports/`). Por ejemplo, `AddTransactionUseCase` orquesta el proceso de crear una transacción, y `ScanReceiptUseCase` coordina el flujo de OCR (imagen → motor OCR → parser → resultado). El puerto `OcrPort` define el contrato que debe cumplir cualquier motor de OCR, permitiendo intercambiar implementaciones sin tocar la lógica.

## 3. Capa de Infraestructura (`src/infrastructure/`)
Contiene los **Adaptadores de Salida**. `LocalStorageTransactionRepository.js` guarda datos en el navegador. `TesseractOcrAdapter.js` implementa el reconocimiento de texto usando Tesseract.js. Si en el futuro queremos usar una base de datos real o Google Cloud Vision para OCR, solo creamos nuevos adaptadores aquí.

## 4. Capa de Interfaz de Usuario (`src/ui/`)
Contiene los **Adaptadores de Entrada**. `WebUIAdapter.js` escucha eventos del navegador y los traduce en llamadas a casos de uso. `OcrUIAdapter.js` maneja el modal de escaneo de tickets (drag & drop, progreso, resultados editables).

## Flujo de Dependencias
Las dependencias siempre apuntan hacia el centro (el dominio). La infraestructura depende del dominio, pero el dominio no depende de nadie. Esto se logra mediante la **Inyección de Dependencias** realizada en el bootstrapper principal (`src/main.js`).

