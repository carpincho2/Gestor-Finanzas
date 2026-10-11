# Diagnóstico Integral y Roadmap: ¿Qué le falta a la Sección Buscador SEPA?

Este documento presenta una auditoría técnica profunda, funcional y arquitectónica del módulo de **Buscador de Precios SEPA** (*Sistema Electrónico de Publicidad de Precios Argentinos*) del Gestor de Finanzas. El análisis examina la experiencia de compra inteligente en supermercados, la integración con las finanzas personales del usuario, los principios **SOLID**, la arquitectura **PHAME** (Clean/Hexagonal) y la integridad de datos.

---

## 1. Resumen Ejecutivo del Estado Actual

El módulo de Precios SEPA cuenta actualmente con una arquitectura hexagonal bien delineada:
- **Backend:**
  - Capa de dominio: Entidades desacopladas (`ProductWithPricesEntity`, `StorePriceEntity`, `SingleProductComparisonEntity`).
  - Capa de aplicación: Casos de uso centralizados en `SepaUseCases` que orquestan validaciones de coordenadas y políticas de búsqueda.
  - Capa de infraestructura: `SQLAlchemyPriceRepository` implementando el puerto `PriceRepositoryPort`, filtrado geográfico por Haversine y cálculo de promociones bancarias (`promociones.py`).
  - Endpoints REST en FastAPI: `/api/precios` (búsqueda unitaria profunda con costo de transporte) y `/api/precios/buscar` (búsqueda multi-producto con agregaciones de precio promedio y mejor oferta).
- **Frontend Web & Mobile:**
  - Barra de búsqueda por texto o código EAN.
  - Filtros interactivos de radio (2 a 35 km), cadena de supermercado (Coto, Carrefour, Día, Jumbo, etc.) y ordenamiento (precio, distancia, ahorro).
  - Selector de ciudades argentinas (CABA, GBA Norte/Sur/Oeste, Rosario, Córdoba, Mendoza, Mar del Plata) con fallback y GPS automático.
  - Tarjetas de producto en formato acordeón con badge de mejor precio 🏆, tachado de precio de lista y botones directos a Google Maps y "Calcular Cuotas" en el Asistente de Compras.

A pesar de esta sólida base, existen **brechas funcionales críticas de producto, oportunidades ergonómicas de UI/UX y capacidades analíticas avanzadas** que separan al buscador actual de un asistente de supermercado de clase mundial.

---

## 2. Brechas Funcionales de Negocio (Core Fintech & Ahorro)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   BRECHAS FUNCIONALES PRINCIPALES                      │
├─────────────────────────┬──────────────────────┬───────────────────────┤
│ 1. Canasta / Changuito  │ 2. Escáner de Cámara │ 3. Historial de       │
│    Multiproducto        │    con Barcode Real  │    Precios e Inflación│
│    (Split Shopping)     │    en góndola        │    (Trend Sparkline)  │
├─────────────────────────┼──────────────────────┼───────────────────────┤
│ 4. Cruce con Cuentas    │ 5. Convertir Compra  │ 6. Watchlist de       │
│    Promociones según tus│    a Gasto Directo   │    Productos          │
│    tarjetas registradas │    en 1 clic         │    Favoritos/Básicos  │
└─────────────────────────┴──────────────────────┴───────────────────────┘
```

### 2.1. Canasta de Compras Multiproducto ("Changuito Inteligente" / Split Shopping)
- **Problema:** La búsqueda actual se realiza producto por producto. Nadie va al supermercado a comprar únicamente un paquete de fideos; una compra mensual promedio tiene entre 15 y 40 ítems.
- **Lo que falta:**
  1. **Lista de la compra / Carrito:** Posibilidad de armar una lista (ej. *2 Leches + 1 Aceite + 3 Arroz + 1 Jabón*).
  2. **Optimizador de Supermercado Único:** Indicar cuál supermercado cercano tiene el total del ticket más barato para la canasta completa.
  3. **Compra Dividida Sugerida (Split Basket Optimization):** Algoritmo que calcula si conviene dividir la compra entre dos cadenas cercanas para maximizar el ahorro:
     $$\text{Ahorro Neto} = (\text{Ahorro Precios Cadenas}) - (\text{Costo extra de traslado})$$
     *Ejemplo:* "Comprá los lácteos y carnes en Coto (\$22.000) y los productos de almacén en Día (\$14.500) para ahorrar \$6.200 (15%)".

### 2.2. Escáner de Código de Barras con la Cámara del Dispositivo (Góndola Real)
- **Problema:** El botón de código de barras actual usa `window.prompt()`, obligando al usuario a escribir manualmente los 13 dígitos del EAN en su teléfono.
- **Lo que falta:** Reutilizar el módulo de escaneo de cámara que la aplicación ya posee (`scanner.ts` con WebRTC / BarcodeDetector API) para que el usuario apunte con la cámara del teléfono al código de barras del producto en la góndola y obtenga la comparativa instantánea.

### 2.3. Historial de Precios y Seguimiento de Inflación por Producto
- **Problema:** El usuario solo ve el precio actual. No sabe si el precio aumentó esta semana, si la oferta es real o si está en su piso histórico.
- **Lo que falta:**
  - Micro-gráfico de tendencia (*sparkline*) de los últimos 30 a 90 días por producto y cadena.
  - Indicador de variación: *"Subió un 4.8% en los últimos 15 días"* o *"🏷 Mínimo histórico del mes"*.

### 2.4. Cruce Inteligente con las Tarjetas y Billeteras del Usuario
- **Problema:** Las promociones bancarias en `promociones.py` son genéricas. El usuario no sabe a simple vista si **él personalmente** puede aprovechar el descuento.
- **Lo que falta:** Conectar con la sección **Cuentas**:
  - Si el usuario tiene registradas tarjetas de *Banco Santander*, *Galicia* o billeteras como *Cuenta DNI* y *Mercado Pago*, resaltar en color primario:
    *"🎉 Tenés un 20% de reintegro hoy con tu Cuenta DNI registrada"*.

### 2.5. Registro Rápido de Compra como Transacción
- **Problema:** Tras encontrar el mejor precio o hacer la compra, el usuario debe ir manualmente a la pestaña "Transacciones" y cargar el gasto de cero.
- **Lo que falta:** Botón de **"Registrar como Gasto"** en la sucursal elegida, que precargue:
  - Concepto: `Supermercado [Nombre] - [Producto]`
  - Monto: `Precio Final`
  - Categoría: `Alimentación`
  - Fecha: `Hoy`

### 2.6. Lista de Favoritos y Canasta Básica Personalizada (Watchlist)
- **Problema:** Productos frecuentes (yerba, leche, aceite, café) requieren ser buscados uno por uno repetidamente.
- **Lo que falta:** Sección de "Mis Productos Habituales" con seguimiento constante de sus variaciones y alertas cuando bajan de precio en el supermercado de cabecera.

---

## 3. Experiencia de Usuario (UI/UX)

1. **Mapa Interactivo de Supermercados:**
   - En lugar de solo tener un botón hacia un enlace externo de Google Maps, incorporar una vista modal o embebida de mapa (Leaflet / OpenStreetMap) que dibuje los pines de las sucursales con colores según su conveniencia (verde = más económica, naranja = promedio, rojo = más cara).
2. **Filtros por Marca:**
   - Al buscar "leche" aparecen múltiples marcas (La Serenísima, Milkaut, marcas propias). Poder filtrar mediante chips interactivos por marca específica.
3. **Paginación y Vista de Tarjeta/Lista:**
   - Botón de "Cargar más resultados" cuando una búsqueda genérica arrojó más de 15 coincidencias.
4. **Resistencia Offline (PWA):**
   - Guardar en almacenamiento local (`IndexedDB` o `localStorage`) los últimos resultados buscados y la lista de compras del usuario para que funcione dentro de los hipermercados donde frecuentemente no hay cobertura de datos móviles.

---

## 4. Infraestructura de Datos y Backend

1. **Robustez en la Ingesta de Datos SEPA:**
   - La URL de descarga oficial en `datos.produccion.gob.ar` cambia de UUID periódicamente. Se debe incorporar una consulta a la API CKAN (`package_show?id=sepa-precios`) para resolver dinámicamente el UUID del recurso más reciente antes de descargar el ZIP.
2. **Caché Espacial y de Precios:**
   - Implementar caché de segundo nivel (memoria o Redis) para consultas repetidas en un mismo radio geográfico (ej: `caba:leche:radio_10`), reduciendo el costo de consulta sobre las tablas de precios.
3. **Cobertura Automatizada de Tests:**
   - Mantener al día la suite de tests unitarios de `test_sepa.py` validando la inyección de dependencias, fallbacks de coordenadas y serialización Pydantic.

---

## 5. Plan de Acción y Roadmap de Implementación

| Fase | Título | Alcance | Impacto |
|---|---|---|---|
| **Fase 1** | **Lista de Compras & Integración SEPA** | Sección de Lista del Súper con sincronización reactiva bidireccional y chips de búsqueda automática en SEPA. | **Completado ✅** |
| **Fase 2** | **Escáner Góndola & Registro de Gasto** | Lector de código de barras con cámara nativa + botón de registrar como transacción directa. | Alto / Inmediato |
| **Fase 3** | **Cruce con Billeteras del Usuario** | Detección reactiva de promociones según las cuentas y tarjetas registradas en la app. | Alto (Diferencial Fintech) |
| **Fase 4** | **Canasta Familiar & Carrito Multiproducto** | Comparador de lista completa de supermercado con optimización de compra única vs dividida. | Crítico (Ahorro Masivo) |
| **Fase 5** | **Historial de Precios & Mapa Embebido** | Tendencia de inflación por producto + visualización geográfica en mapa interactivo. | Medio / Visual |

---

## 6. Módulo Implementado: "Mi Lista de Compras" e Integración SEPA

Se implementó una nueva sección de primer nivel en la barra lateral (**Lista del Súper**) con sinergia directa hacia el Buscador SEPA:
1. **`ShoppingListService` (`js/services/shoppingListService.ts`):** Servicio con principios SOLID (SRP) que administra ítems, persistencia en `localStorage` (aislado por usuario con `userKey`), estado de completado, borrado por lotes, canastas básicas rápidas (*Básicos del Mes, Desayuno, Limpieza*) y suscripción reactiva.
2. **`ShoppingListController` (`js/shoppingList.ts`):** Controlador de la vista `html/views/lista_compras.html` que gestiona altas, bajas, checks y el botón *"Comparar en SEPA"* que redirige automáticamente al buscador precargando el producto.
3. **Integración Predeterminada en Buscador SEPA (`js/supermercados.ts`):**
   - Al abrir el Buscador SEPA, se detecta la lista de compras del usuario y se renderizan **chips interactivos con sus productos pendientes** arriba de las sugerencias fijas.
   - Si el usuario toca cualquier chip de su lista de compras, se ejecuta la búsqueda de ofertas en supermercados inmediatamente.
   - En cada resultado de búsqueda de productos del SEPA, se incorporó el botón **`➕ A mi lista`** para agregar ofertas encontradas a la lista de compras en un solo clic.

