# PROMPT DE INGENIERÍA: ASISTENTE DE COMPRAS E INTEGRACIÓN CON MERCADO LIBRE

Copie y pegue el siguiente bloque de texto en su IDE (Cursor, VS Code con Copilot, ChatGPT o Claude) para generar la implementación completa de la funcionalidad del Asistente de Compras Inteligente.

---

```text
ACTÚA COMO UN ARQUITECTO DE SOFTWARE Y DESARROLLADOR FULL-STACK EXPERTO. 

Necesito implementar una funcionalidad avanzada de "Asistente de Compras Inteligente" para mi aplicación de gestión de gastos personales. El objetivo es que el usuario pueda ingresar un producto de Mercado Libre (por búsqueda, pegando el link o escaneando el código de barras) y el sistema le recomiende la mejor opción financiera de pago, basándose en los saldos y tarjetas que tiene registrados en la app.

### 1. STACK TECNOLÓGICO
- **Frontend:** Flutter (Mobile).
- **Backend:** API REST con FastAPI (Python).
- **Base de Datos:** PostgreSQL.

---

### 2. ARQUITECTURA Y REQUERIMIENTOS TÉCNICOS

#### A. MODELO DE DATOS (PostgreSQL / FastAPI)
Genera los modelos de BD y esquemas Pydantic para soportar las finanzas del usuario. Asume que estas tablas ya tendrán datos simulados:
1. `cuentas_billeteras`: (id, usuario_id, nombre_cuenta, tipo_cuenta ['Débito', 'Crédito', 'Billetera Virtual'], saldo_disponible, limite_credito).

#### B. ENDPOINTS DEL BACKEND (FastAPI)
Genera los siguientes endpoints con buenas prácticas (APIRouter, inyección de dependencias, manejo de errores):

1. **`POST /api/v1/compras/analizar-url`**: 
   - Recibe una URL de Mercado Libre y extrae el ID del artículo (Regex).
   - Consume la API de Mercado Libre (`[https://api.mercadolibre.com/items/](https://api.mercadolibre.com/items/){item_id}`) para obtener: precio y moneda.
   - **Endpoint Dinámico:** Este endpoint también debe recibir (opcionalmente) parámetros ingresados por el usuario desde la UI, como `% de descuento bancario` o `cantidad de cuotas sin interés específicas de su banco`.
   - Ejecuta el **Motor de Recomendación** (Sección 3) y devuelve las opciones de pago ordenadas por conveniencia.

2. **`GET /api/v1/compras/buscar`**:
   - Recibe un `q` (ej: "Auriculares").
   - Consume la API de ML (`[https://api.mercadolibre.com/sites/MLA/search?q=](https://api.mercadolibre.com/sites/MLA/search?q=){query}`).
   - Retorna los primeros 5 resultados (ID, título, precio, thumbnail) limpios para Flutter.

3. **`POST /api/v1/compras/analizar-codigo`**:
   - Recibe un GTIN/EAN.
   - Consume la API de ML (`[https://api.mercadolibre.com/products/search?gtin=](https://api.mercadolibre.com/products/search?gtin=){codigo}`).
   - Retorna la info del producto y ejecuta el **Motor de Recomendación**.

#### C. COMPONENTES DEL FRONTEND (Flutter)
Genera el código de Flutter organizado (Widgets, State Management y Services):

1. **Pantalla Principal (`AsistenteComprasScreen`)**: Centraliza los 3 métodos de entrada:
   - *Pestaña Buscador:* Barra de búsqueda nativa que renderiza tarjetas. Al tocar un producto, dispara el análisis.
   - *Pestaña Link:* Campo inteligente para pegar URLs manuales.
   - *Pestaña Escáner:* Botón para iniciar la cámara (usa `mobile_scanner`) y capturar códigos de barras.
2. **Share Intent (`ShareIntentService`)**: Configuración con `receive_sharing_intent` para interceptar enlaces de ML compartidos desde fuera de la app y llevar al usuario directo al análisis.
3. **Vista de Resultados Interactiva (`ResultadoAnalisisScreen`)**:
   - Muestra el precio base del producto y las opciones de pago que detectó la API.
   - **CRÍTICO - ENFOQUE HÍBRIDO (Input-First):** Debe incluir una sección tipo formulario rápido donde el usuario pueda ingresar manualmente si tiene alguna promoción bancaria (ej. "Descuento %" o "X cuotas sin interés"). Al ingresar un dato, la pantalla debe recalcular todo al instante.
   - Destaca la **Opción Ganadora** (ej. "Pagá con Tarjeta Crédito en 3 cuotas") y explica matemáticamente por qué (usando VPN, TNA, CFT). Muestra una lista secundaria con el resto de las cuentas registradas del usuario.

---

### 3. LÓGICA DEL MOTOR DE RECOMENDACIÓN (Algoritmo Financiero)
Crea una función de evaluación en Python que use métricas financieras formales (como Valor Presente Neto - VPN o Costo Financiero Total - CFT) para ranquear las cuentas del usuario contra el producto.
- **Validación:** Si es Débito/Billetera, `saldo_disponible` >= precio. Si es Crédito, `limite_credito` >= precio. Si falla, va al final de la lista marcado como "Fondos Insuficientes".
- **Cálculo Base:** Prioriza cuotas sin interés si la inflación o TNA estimada de referencia (ej. 40%) indica que el dinero rinde más en un FCI (Costo de Oportunidad).
- **Recálculo por Usuario:** Si el usuario mandó parámetros extra desde la UI (ej. 15% de reintegro por su banco), el algoritmo debe aplicar ese descuento al cálculo final y posiblemente cambiar el ranking de la opción ganadora.

---

### 4. CRITERIOS DE ACEPTACIÓN
1. Manejo estricto de errores (404 si ML no encuentra el producto, 500 si falla la API).
2. Arquitectura limpia en Flutter (especifica Provider, BLoC o Riverpod).
3. Todo el código comentado en español explicando la matemática financiera oficial utilizada.
4. UI en pesos argentinos (ARS) con formato `$ ###.###,##`.

Por favor, genera el código paso a paso: Modelos y Endpoints (FastAPI), Motor Matemático (Python), y UI/Services (Flutter).