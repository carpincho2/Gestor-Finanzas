# Evolución y Mejoras de la Sección de Objetivos de Ahorro

Este documento detalla la reingeniería y ampliación de capacidades del módulo de **Objetivos de Ahorro**, tanto a nivel de backend (FastAPI / SQLAlchemy / Arquitectura Hexagonal) como de frontend (TypeScript / Vite / CSS Modular), orientadas a la inteligencia financiera preventiva, soporte multidivisa, conciliación patrimonial con cuentas reales y la adherencia estricta a los principios **SOLID** y arquitectura **PHAME**.

---

## 1. Problemas Detectados en la Versión Anterior

1. **Bug Lógico en el Estado del Objetivo (`behind` / Demorado):**
   - La función `goalStatus()` evaluaba una condición inalcanzable (`needed < 0`), haciendo que ningún objetivo activo pudiera figurar como `behind` (demorado), incluso si la fecha límite estaba próxima y el usuario no había ahorrado casi nada.
2. **Carencia de Moneda en el Modelo (`currency`):**
   - La tabla `goals` no contemplaba el campo `currency`. Todo el frontend estaba hardcodeado a pesos argentinos (`$`), imposibilitando el seguimiento de metas en moneda dura (`USD`, `EUR`), comunes en objetivos de mediano y largo plazo (viajes, tecnología, autos, fondo de retiro).
3. **Aportes "En el Aire" (Desconexión de Cuentas Reales):**
   - Registrar un aporte a una meta simplemente incrementaba un contador numérico en `goal.current`. No descontaba el dinero de ninguna cuenta bancaria o billetera (`Account`), ni validaba saldo, generando metas ficticias desconectadas de la realidad patrimonial.
4. **Imposibilidad de Retirar Fondos ("Desahorro"):**
   - El sistema únicamente permitía registrar aportes positivos. Si el usuario necesitaba retirar dinero de su meta (por emergencia o para señar su compra), solo podía borrar aportes pasados, destruyendo la auditoría histórica.
5. **Carencia de Toolbar, Filtros y Ordenamiento Dinámico:**
   - La sección carecía de una barra de herramientas como la de Presupuestos. No se podían filtrar objetivos por estado (`En curso`, `Demorados`, `Completados`, `Pausados`), ni por moneda, ni ordenar por vencimiento, avance o monto restante.
6. **Inexistencia de Controles de Ciclo de Vida (Pausar / Reanudar):**
   - A pesar de que la base de datos admitía el estado `paused`, no existía control en la interfaz para pausar o reactivar metas temporales.
7. **Estilos en línea en HTML:**
   - Múltiples declaraciones de diseño residían en atributos `style="..."` en lugar de residir modularmente en `css/views/goals.css`.

---

## 2. Soluciones Implementadas

### A. Backend y Persistencia
- **Modelo de Datos (`api/models.py`):**
  - Se agregó la columna `currency = Column(String(10), default="ARS", nullable=False)` y `start_date = Column(String(50), nullable=True)` a la tabla `goals`.
  - Se agregó la columna `account_id = Column(Integer, nullable=True)` y `type = Column(String(20), default="deposit")` a la tabla `goal_contributions`.
- **Esquema Pydantic (`api/schemas.py`):**
  - Se incorporó `currency: Optional[str] = "ARS"` y `start_date: Optional[str] = None` en `GoalCreate`.
  - Se incorporó `account_id: Optional[int] = None` y `type: Optional[str] = "deposit"` en `GoalContributionCreate`.
- **Capa de Servicio (`api/services/goal_service.py`):**
  - **Inyección de Dependencias:** `GoalService` ahora recibe opcionalmente `IAccountRepository` para conciliar saldos de cuentas en tiempo real.
  - **Aportes y Retiros:** Si el movimiento es un aporte (`deposit`), descuenta de la cuenta origen y suma al objetivo; si es un retiro (`withdraw`), reintegra a la cuenta y reduce el acumulado de la meta.
  - **Reversión en Eliminación:** Al eliminar un movimiento con cuenta asociada, se revierte con exactitud el impacto patrimonial.
  - **Pausa y Reanudación:** Se incorporó el método `toggle_status()` y el endpoint `PATCH /api/goals/{id}/status`.
- **Migración Automática Idempotente (`api/main.py`):**
  - Se amplió `migrate_schema_columns()` para verificar y aplicar automáticamente las nuevas columnas en `goals` y `goal_contributions` sin pérdida de datos.
- **Pruebas Unitarias (`api/tests/test_goals.py`):**
  - Se ampliaron las pruebas unitarias cubriendo creación con divisa, inicio de meta, alternancia de estados, aportes con impacto en cuentas, retiros y reversión de balances. Cobertura: 100% verde (8 tests dedicados, 23 tests en suite completa).

### B. Frontend e Inteligencia Financiera
- **Ritmo de Ahorro y Detección de Demoras (`js/goals.ts`):**
  - Se calcula el porcentaje de tiempo transcurrido en el ciclo de vida de la meta:
    $$\text{Progreso Temporal (\%)} = \frac{\text{Tiempo Transcurrido}}{\text{Tiempo Total}} \times 100$$
    $$\text{Progreso Financiero (\%)} = \frac{\text{Ahorrado}}{\text{Meta}} \times 100$$
  - Si el progreso financiero está rezagado respecto al progreso temporal ($\text{Progreso Financiero} < \text{Progreso Temporal} - 12\%$) o restan menos de 30 días con menos del 60% acumulado, el estado predictivo se marca con precisión como **⚠️ Demorado (`behind`)**.
  - **Marcador de Ritmo en Barra de Progreso:** La barra de avance incluye un indicador visual vertical (`.ov-pace-marker`) que refleja dónde debería encontrarse el ahorro según el tiempo transcurrido.
- **Soporte Multidivisa Completo:**
  - Selector de divisas (`ARS`, `USD`, `EUR`) en el modal de nueva meta y edición.
  - Formateo adaptado por divisa con `formatMoney(monto, curr)` (`$`, `US$`, `€`).
  - Resumen global agrupado con desglose multimoneda.
- **Toolbar de Filtros, Ordenamiento y Búsqueda:**
  - Filtros rápidos por estado: `Todos`, `En curso`, `Demorados`, `Completados`, `Pausados`.
  - Filtro por moneda: `Todas`, `ARS`, `USD`, `EUR`.
  - Ordenamiento configurable: `Vencimiento más cercano`, `Mayor progreso (%)`, `Mayor faltante ($)`, `Meta más alta`, `Nombre (A-Z)`.
  - Buscador reactivo por nombre, categoría o nota.
- **Movimientos de Retiro y Vinculación Bancaria:**
  - En el modal de aporte se añadió el selector de tipo de movimiento (`📥 Aporte (+)` vs `📤 Retiro (-)`) y el selector de cuenta de origen/destino (`cmAccount`).
- **Botón Rápido de Pausa / Reanudación:**
  - Cada tarjeta de objetivo dispone de un botón directo `⏸ / ▶️` para suspender temporalmente el objetivo sin eliminarlo ni perder su historial.
- **Panel de Ritmo y Proyecciones:**
  - Muestra el aporte mensual acumulado requerido por divisa, la cantidad de metas al día y las que requieren atención prioritaria.

---

## 3. Principios de Diseño y Arquitectura (SOLID & PHAME)

- **Single Responsibility Principle (SRP):**
  - `goalService.ts` encapsula las llamadas HTTP a `/api/goals` y la persistencia local de estado.
  - `goals.ts` se encarga exclusivamente del ciclo de vida del DOM, eventos de interfaz y proyecciones visuales.
  - `GoalService` en backend contiene la lógica de negocio y cálculo contable.
- **Dependency Inversion Principle (DIP):**
  - `GoalService` depende de las abstracciones de repositorio (`IGoalRepository` y `IAccountRepository`), desacoplándose de la implementación concreta de base de datos.
- **Open/Closed Principle (OCP):**
  - El motor de filtrado y ordenamiento en el frontend está parametrizado por funciones de comparación que permiten añadir nuevos criterios de búsqueda sin modificar el renderizador de tarjetas.
- **Clean Architecture / PHAME:**
  - Eliminación total de estilos en línea en `html/views/objetivos.html`, centralizándolos en `css/views/goals.css`.
  - Tipado riguroso con TypeScript (`Goal`, `GoalContribution`) en `js/types.ts`.
