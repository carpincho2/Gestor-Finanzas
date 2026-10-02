# Evolución y Mejoras de la Sección de Presupuestos

Este documento detalla la reingeniería y ampliación de capacidades del módulo de **Presupuestos**, tanto a nivel de backend (FastAPI / SQLAlchemy) como de frontend (TypeScript / Vite / CSS Modular), orientadas a la inteligencia financiera preventiva y la adherencia estricta a los principios **SOLID** y arquitectura **PHAME**.

---

## 1. Problemas Detectados en la Versión Anterior

1. **Gastos Invisibles ("Falso Saldo Disponible"):**
   - El sistema únicamente computaba los gastos que correspondían a una categoría con presupuesto asignado. Si el usuario gastaba en categorías sin presupuesto (ej: imprevistos, ropa, salidas ocasionales), el panel seguía informando que le sobraba dinero disponible, ocultando el sobregiro real.
2. **Carencia de Moneda en el Modelo:**
   - La tabla `budgets` no contemplaba el campo `currency`. Si el usuario gestionaba cuentas y gastos en USD y ARS, los montos se trataban de manera homogénea.
3. **Visión Financiera Pasiva (Falta de Proyecciones y Ritmo):**
   - La barra de porcentaje indicaba qué porcentaje del límite se había consumido, pero no si dicho consumo era razonable para la altura del mes en la que se encontraba el usuario (*Burn Rate*).
4. **Falta de Alertas Preventivas al Cargar Gastos:**
   - Al registrar un gasto en el modal de transacciones, el usuario no recibía feedback sobre si esa compra superaría el límite de su categoría hasta después de haberla registrado y navegar a presupuestos.
5. **Carencia de Filtros y Ordenamiento:**
   - No se podían filtrar presupuestos en peligro ni ordenarlos por porcentaje de consumo o monto.

---

## 2. Soluciones Implementadas

### A. Backend y Persistencia
- **Modelo de Datos (`api/models.py`):**
  - Se agregó la columna `currency = Column(String(10), default="ARS", nullable=False)` a la tabla `budgets`.
- **Esquema Pydantic (`api/schemas.py`):**
  - Se incorporó `currency: Optional[str] = "ARS"` en el DTO `BudgetCreate`.
- **Capa de Servicio (`api/services/budget_service.py`):**
  - Se actualizó `BudgetService` para persistir y actualizar el atributo `currency` garantizando que los textos se normalicen en mayúsculas (`payload.currency.strip().upper()`).
- **Migración Automática Idempotente (`api/main.py`):**
  - Se extendió `migrate_schema_columns()` para verificar si la columna `currency` existe en la tabla `budgets` y ejecutar `ALTER TABLE budgets ADD COLUMN currency VARCHAR(10) DEFAULT 'ARS'` en bases SQLite y PostgreSQL de manera transparente al iniciar el backend.
- **Pruebas Unitarias (`api/tests/test_budgets.py`):**
  - Se ampliaron las pruebas unitarias para validar la creación, actualización y aislamiento de la moneda (`ARS` y `USD`), logrando 100% de cobertura verde.

### B. Frontend e Inteligencia Financiera
- **Detección de Gastos No Presupuestados (`js/budgets.ts`, `html/views/budgets.html`, `css/views/budgets.css`):**
  - Se analizan las transacciones del mes y se aíslan aquellas categorías que no tienen presupuesto fijado.
  - La cabecera ahora muestra con precisión:
    - **Presupuestado**
    - **Gastado (en Presupuestos)**
    - **No Presupuestado (en color de advertencia)**
    - **Disponible Neto Real** ($\text{Límite} - \text{Gastado Ppto} - \text{No Presupuestado}$).
  - Se implementó un panel interactivo de *"Gastos No Presupuestados"* con acción rápida `+ Presupuestar` que abre el modal preconfigurado con la categoría y un límite sugerido (+15% de holgura).
- **Ritmo de Gasto (*Burn Rate*) y Marcador de Tiempo:**
  - Se calcula el porcentaje de tiempo transcurrido en el mes:
    $$\text{Tiempo Transcurrido (\%)} = \frac{\text{Día Actual}}{\text{Días Totales del Mes}} \times 100$$
  - En cada barra de presupuesto se visualiza un marcador vertical (`.bv-pace-marker`) que señala en qué punto del mes nos encontramos. Si la barra de consumo sobrepasa el marcador, se etiqueta como `Ritmo acelerado`.
- **Proyecciones a Fin de Mes y Saldo Diario Restante:**
  - Para el mes en curso, se proyecta el gasto estimado:
    $$\text{Gasto Proyectado} = \frac{\text{Gasto Actual}}{\text{Día Actual}} \times \text{Días Totales}$$
  - Se calcula el gasto diario recomendado para no romper el presupuesto:
    $$\text{Disponible Diario} = \frac{\text{Disponible Restante}}{\text{Días Restantes}}$$
- **Alerta Preventiva en Modal de Nueva Transacción (`js/transactions.ts`):**
  - Al tipear el monto o seleccionar la categoría en el modal de transacciones, un banner reactivo (`#mBudgetImpact`) evalúa en tiempo real el saldo remanente y advierte:
    - 🚨 *Presupuesto excedido* (si el gasto quiebra el límite).
    - ⚡ *Atención* (si el saldo restante cae por debajo del 20%).
    - ✅ *En presupuesto* (indicando cuánto quedará disponible tras la compra).
- **Filtros y Ordenamiento Dinámico:**
  - Filtros: `Todos`, `En Riesgo / Excedidos`, `En Presupuesto`.
  - Ordenamiento: `Mayor consumo (%)`, `Mayor gasto ($)`, `Límite más alto`, `Nombre (A-Z)`.

---

## 3. Principios de Diseño y Arquitectura (SOLID & PHAME)

- **Single Responsibility Principle (SRP):**
  - `budgetService.ts` encapsula las peticiones de red y persistencia.
  - `budgets.ts` se enfoca en el renderizado y los eventos de usuario.
  - `BudgetService` en backend administra las reglas de negocio de la entidad.
- **Open/Closed Principle (OCP):**
  - Los mecanismos de ordenamiento y filtrado fueron estructurados mediante funciones puras desacopladas que permiten incorporar nuevos criterios (ej. por tags o períodos) sin alterar la lógica de renderizado de tarjetas.
- **Don't Repeat Yourself (DRY):**
  - Reutilización de formateadores monetarios y utilidades de escape HTML compartidas.
- **Clean Architecture / PHAME:**
  - Desacoplamiento total entre estilos (`budgets.css`), vistas (`budgets.html`), lógica cliente (`budgets.ts`) y servicios backend desacoplados mediante Inyección de Dependencias en FastAPI.
