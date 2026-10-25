# Diagnóstico Integral y Roadmap: ¿Qué le falta a la Sección Asistente de Compras?

Este documento presenta una auditoría técnica, financiera, funcional y arquitectónica del módulo **Asistente de Compras Inteligente** (`Shopping`) del Gestor de Finanzas **Flujo**. El análisis evalúa el estado actual de la herramienta frente a los estándares de ingeniería de software (**SOLID**, **PHAME**, Clean/Hexagonal Architecture), precisión matemática financiera y paridad multiplataforma (Web vs. Flutter Mobile).

---

## 1. Resumen Ejecutivo del Estado Actual

El módulo de **Asistente de Compras** cuenta hoy con capacidades importantes ya operativas:
- **Extracción Universal Multitienda (Backend):** Patrón *Strategy + Registry* ([`ProductExtractorRegistry`](../api/services/shopping/extractor_registry.py)) con soporte para Mercado Libre ([`MercadoLibreExtractor`](../api/services/shopping/mercadolibre_extractor.py) usando OAuth de Mercado Pago) y comercios generales ([`GenericECommerceExtractor`](../api/services/shopping/generic_extractor.py) mediante Schema.org JSON-LD, OpenGraph, Microdata y heurísticas HTML).
- **Motor Matemático de Valor Presente Neto ([`recommendation.py`](../api/services/recommendation.py)):** Compara el pago al contado frente a planes de 1, 3, 6, 9, 12, 18 y 24 cuotas (sin interés o con recargo porcentual/monto fijo), descontando los flujos futuros con la Tasa Efectiva Mensual ($\text{TEM} = \frac{\text{TNA}}{12}$).
- **Interfaz Web Multimodal ([`js/shopping.ts`](../js/shopping.ts)):** Tres modos de entrada (*Link Web*, *Buscar Producto*, *Código de Barras*), alerta de impacto en presupuesto, registro directo de gasto en 1 clic e historial reciente en `localStorage`.

Sin embargo, al auditar en profundidad el código fuente de [`js/shopping.ts`](../js/shopping.ts), [`api/services/shopping_service.py`](../api/services/shopping_service.py), [`api/services/recommendation.py`](../api/services/recommendation.py) y [`mobile/lib/screens/shopping_screen.dart`](../mobile/lib/screens/shopping_screen.dart), se identifican **brechas financieras, funcionales, arquitectónicas y de paridad móvil** fundamentales para llevar la sección a un nivel de clase mundial.

---

## 2. Brechas Financieras y Contables (Core Fintech)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     BRECHAS FINANCIERAS PRINCIPALES                          │
├───────────────────────────┬─────────────────────────┬────────────────────────┤
│ 1. Ciclo de Tarjeta       │ 2. Tope de Reintegro    │ 3. Tasa de Equilibrio  │
│    Días reales al 1° pago │    Límite en $ para     │    Inflación BreakEven │
│    según Cierre/Vencim.   │    promociones bancarias│    y CFT Implícito     │
├───────────────────────────┼─────────────────────────┼────────────────────────┤
│ 4. Cronograma de Licuación│ 5. Compras en USD       │ 6. Impacto Contable    │
│    Tabla cuota a cuota de │    Dólar Tarjeta vs     │    Compromiso de cupo  │
│    valor real vs nominal  │    Dólar MEP en vivo    │    y cuotas futuras    │
└───────────────────────────┴─────────────────────────┴────────────────────────┘
```

### 2.1. Integración con Fecha de Cierre y Vencimiento de cada Tarjeta ("Días de Gracia")
- **Problema actual:** En [`api/services/recommendation.py`](../api/services/recommendation.py), la función `calculate_vpn` asume que la primera cuota de cualquier tarjeta se paga exactamente en $t = 1$ (30 días):
  $$\text{VPN} = \text{Cuota} \times \frac{1 - (1 + \text{TEM})^{-n}}{\text{TEM}}$$
- **Realidad financiera:** En el módulo de **Cuentas**, cada tarjeta de crédito ya posee los campos `closing_day` (día de cierre) y `due_day` (día de vencimiento).
  - Si una tarjeta cerró ayer, comprar hoy otorga **hasta 40–45 días gratis** antes de abonar la primera cuota (incluso comprando en "1 pago", funciona como un préstamo a 45 días a tasa 0%).
  - Si otra tarjeta cierra mañana, el primer pago vence en solo **10–15 días**.
- **Lo que falta:** Ajustar el descuento compuesto considerando los días exactos hasta el primer resumen ($d_1$) de cada tarjeta específica:
  $$\text{VPN}_{\text{real}} = \sum_{k=0}^{n-1} \frac{\text{Cuota}}{(1 + \text{TED})^{d_1 + 30k}}, \quad \text{donde } \text{TED} = \frac{\text{TNA}}{365}$$
  Destacando en la recomendación: *"🔥 Tu tarjeta Visa Galicia cerró hace 2 días: tenés 41 días de rendimiento en FCI antes de pagar el primer resumen"*.

### 2.2. Tope de Reintegro Bancario (`Refund Cap`)
- **Problema actual:** El parámetro `discount_percentage` calcula un descuento lineal ilimitado: `cash_price = price * (1 - discount / 100)`.
- **Realidad financiera:** Las promociones bancarias y de billeteras (MODO, Cuenta DNI, Galicia, Santander) casi siempre imponen un **tope de reintegro en pesos** (ej. *"30% de ahorro, tope de reintegro: \$15.000"*). En una compra de $\$ 300.000$, el 30% lineal simula un ahorro falso de $\$ 90.000$, distorsionando el ranking contra las cuotas sin interés.
- **Lo que falta:** Agregar el campo opcional **"Tope de reintegro (\$)"** (`max_discount_amount`) para que el descuento real sea:
  $$\text{Descuento Efectivo} = \min\left(\text{Precio} \times \frac{\%\text{Desc}}{100},\; \text{Tope}\right)$$

### 2.3. Tasa de Equilibrio (*Break-Even Inflation*) y CFT Implícito
- **Problema actual:** Cuando el comercio aplica recargo en cuotas (`surcharge_percentage` o `installment_total_price`), el sistema muestra el VPN pero no informa cuál es el Costo Financiero Total (CFT) ni la tasa de corte.
- **Lo que falta:** Calcular la **Tasa Interna de Retorno (TIR) / TNA de Equilibrio** de la financiación:
  - Indicar claramente: *"El recargo equivale a una TNA del **52.4%**. Como tu rendimiento actual es del **40%**, te conviene pagar al contado (necesitarías una inflación/TNA mayor al 52.4% para que convengan las cuotas)"*.

### 2.4. Tabla y Gráfico de Licuación Cuota a Cuota
- **Problema actual:** El usuario solo ve un número global (`Costo Real Estimado (VPN)`), lo cual puede resultar abstracto para quien no domina matemática financiera.
- **Lo que falta:** Un desglose desplegable (**Cronograma de Licuación de Cuotas**) que muestre mes por mes:
  - `Mes 1`: Cuota nominal $\$ 20.000 \rightarrow$ Valor presente hoy: $\$ 19.354$
  - `Mes 6`: Cuota nominal $\$ 20.000 \rightarrow$ Valor presente hoy: $\$ 16.438$
  - `Mes 12`: Cuota nominal $\$ 20.000 \rightarrow$ Valor presente hoy: $\$ 13.520$
  Permitiendo visualizar intuitivamente cómo la inflación "licúa" el peso de las últimas cuotas.

### 2.5. Compras Internacionales Multidivisa (Dólar Tarjeta vs. Dólar MEP)
- **Problema actual:** Si [`GenericECommerceExtractor`](../api/services/shopping/generic_extractor.py) detecta un producto en `USD` (ej. Amazon, Tiendamia, Steam), el motor evalúa el monto nominal sin convertir la divisa ni comparar estrategias cambiarias.
- **Lo que falta:** Cuando `currency_id == 'USD'`, conectar con el servicio de cotizaciones (`dolarapi.com`) ya presente en la app y comparar:
  1. **Pagar en Pesos al vencimiento (Dólar Tarjeta):** Cotización Oficial + recargo impositivo.
  2. **Pagar el resumen con Dólar MEP / Dólares en cuenta:** Calculando el ahorro neto en pesos por evitar percepciones al cancelar el resumen con dólares propios antes del vencimiento.

### 2.6. Registro Real de Compras en Cuotas (Compromiso Futuro y Cupo de Tarjeta)
- **Problema actual:** En [`js/shopping.ts`](../js/shopping.ts) (función `quickRegisterShoppingExpense`), al registrar una compra en $N$ cuotas solo se crea una transacción aislada por el valor de **1 cuota** (`Cuota 1/N`).
- **Lo que falta:**
  - Opción en el registro para **generar las cuotas futuras programadas** o registrar el impacto total sobre el límite disponible de la tarjeta de crédito, evitando que el usuario sobreestime su cupo libre para próximas compras.

---

## 3. Brechas de Experiencia de Usuario y Flujo (UI / UX)

### 3.1. Escáner de Cámara en Vivo en la Pestaña "Código de Barras"
- **Problema actual:** En [`js/shopping.ts`](../js/shopping.ts), la pestaña `Código de Barras` solo ofrece un `<input type="text">` manual.
- **Solución:** Integrar el servicio de cámara (`BarcodeDetector` / WebRTC) que ya fue construido para el Buscador SEPA en [`js/supermercados.ts`](../js/supermercados.ts), agregando un botón **`📷 Escanear con Cámara`** para leer el EAN-13 directamente desde el envase del producto.

### 3.2. Autenticación y Fallback en "Buscar Producto" y "Código de Barras"
- **Problema actual:** En [`api/services/shopping_service.py`](../api/services/shopping_service.py), los métodos `search_items` (línea 30) y `analyze_barcode` (línea 134) llaman a `https://api.mercadolibre.com/sites/MLA/search` **sin adjuntar el token OAuth de Mercado Pago del usuario ni headers completos**, y sin un fallback a la base de datos local SEPA o buscador alternativo. Dado que Mercado Libre restringe búsquedas sin token (error `403 Forbidden`), estas dos pestañas pueden fallar con error `502`.
- **Solución:**
  1. Reutilizar el `user_token` OAuth de Mercado Pago en `search_items` y `analyze_barcode`.
  2. Agregar un **fallback multi-fuente**: si la API externa rechaza la búsqueda sin token, consultar la base de datos local de productos (`SQLAlchemyPriceRepository` / SEPA) y/o permitir búsqueda asistida.

### 3.3. Selector Inteligente de Presupuesto y Impacto en Objetivos
- **Problema actual:** En [`js/shopping.ts`](../js/shopping.ts) (línea 780), el cálculo de impacto en presupuesto busca categorías fijas (`['compras', 'shopping', 'tecnologia', 'ocio']`) y, si el usuario no tiene ninguna con ese nombre exacto, **selecciona `state.budgets[0]`** (que podría ser *"Salud"* o *"Transporte"*), generando una alerta incoherente.
- **Solución:**
  - Permitir seleccionar a qué categoría/presupuesto corresponde la compra que se está evaluando (o detectar la categoría según el título del producto).
  - Mostrar también el **Costo de Oportunidad frente a los Objetivos de Ahorro (`state.goals`)**: *"Esta compra equivale al 25% de lo que te falta para completar tu objetivo 'Vacaciones'"*.

### 3.4. Comparador Lado a Lado ("Producto A vs. Producto B" o "Tienda A vs. Tienda B")
- **Problema actual:** Cada análisis reemplaza por completo al anterior en `#shoppingResultsContainer`. Si un usuario duda entre comprar un producto en Mercado Libre a $\$ 220.000$ en 6 cuotas sin interés vs. comprarlo en Frávega a $\$ 185.000$ al contado, debe recordar los números de memoria.
- **Solución:** Botón **"📌 Fijar para comparar"**, permitiendo mantener una oferta anclada y contrastarla contra otra publicación para que el asistente determine cuál de las dos ofertas (combinando precio + financiación) tiene menor VPN real.

---

## 4. Brechas Arquitectónicas (SOLID, PHAME e Índice de Mantenibilidad)

| Criterio | Estado Actual en `Shopping` | Estado Objetivo (Rango Google) |
| :--- | :--- | :--- |
| **HTML Declarativo** | [`html/views/shopping.html`](../html/views/shopping.html) vacío (solo 2 líneas). Todo el HTML se inyecta como strings en JS. | Mover la estructura base y modales a `html/views/shopping.html` y estilos a `css/styles.css` (o `css/shopping.css`). |
| **Separación de Capas (SRP / M)** | [`js/shopping.ts`](../js/shopping.ts) tiene **1.040 líneas** mezclando DOM, red, scraping y cálculo financiero. | Extraer `js/services/shoppingService.ts` (motor VPN, historial con `userKey`, llamadas API) dejando `js/shopping.ts` solo como controlador UI. |
| **Aislamiento Multiusuario** | `saveToShoppingHistory` usa la clave global `'gestor_shopping_history'` en `localStorage` (compartida entre distintos usuarios en el mismo navegador). | Usar `userKey('flujo_shopping_history')` como en el resto de los servicios. |
| **Clean Architecture en Backend** | `ShoppingService.search_items` y `analyze_barcode` usan `requests.get` acoplado directamente y sin inyección de token. | Encapsular búsquedas externas detrás de puertos/adaptadores con manejo resiliente de errores y tests unitarios completos. |

---

## 5. Enfoque Unificado en Plataforma Web Responsive

Para maximizar la velocidad de evolución, eliminar duplicación de código y reducir la deuda técnica global, se definió concentrar el 100% del desarrollo en la **aplicación Web Responsive (`js/`, `html/`, `css/`) + Backend FastAPI (`api/`)**, dejando fuera del alcance el cliente móvil en Flutter (`mobile/`):

1. **Experiencia Móvil Completa vía Web Responsive:** Cualquier usuario desde Android o iOS accede mediante el navegador con soporte completo de menú hamburguesa, tablas adaptables y cámara en vivo (`BarcodeDetector`).
2. **Cero Desfase entre Plataformas:** Todas las mejoras financieras (descuento al contado, tope de reintegro, recargo en cuotas, comparador dual y registro directo como gasto) están disponibles instantáneamente en todos los dispositivos sin necesidad de recompilar binarios `.apk`.

---

## 6. Hoja de Ruta Propuesta (Roadmap de Evolución)

| Fase | Nombre | Alcance Técnico | Prioridad |
| :---: | :--- | :--- | :---: |
| **Fase 1** | **Precisión Financiera Avanzada** | Cálculo de días de gracia según `closing_day`/`due_day` de tarjetas, Tope de Reintegro (`refund_cap`), TNA/CFT de equilibrio (*Break-Even*) y tabla de licuación cuota a cuota. | 🔥 Alta |
| **Fase 2** | **Escáner de Cámara & Buscador Resiliente** | Cámara en vivo (`BarcodeDetector`) en la pestaña Código de Barras + inyección de token OAuth y fallback local en `/api/shopping/search` y `/api/shopping/analyze-barcode`. | 🔥 Alta |
| **Fase 3** | **Refactor SOLID/PHAME & Multiusuario** | Desacoplar `js/services/shoppingService.ts`, migrar template a `html/views/shopping.html`, aislar historial con `userKey()` y selector de presupuesto/categoría al registrar gasto. | ⚡ Media |
| **Fase 4** | **Modo Comparador Dual & Compras USD** | Anclar Oferta A vs. Oferta B (Tienda 1 vs. Tienda 2) + calculadora Dólar Tarjeta vs. Dólar MEP para compras en moneda extranjera. | ⚡ Media |
