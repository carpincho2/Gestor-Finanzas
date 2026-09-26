# Refactorización de Presupuestos (Frontend) - Principio SOLID (SRP) y PHAME

## Cambios realizados
Se refactorizó la lógica de presupuestos en el frontend para cumplir con el Principio de Responsabilidad Única (SRP) de SOLID y las directrices de PHAME.

1. **Creación del Servicio `budgetService.js`**:
   - Se creó el archivo `js/services/budgetService.js` para extraer toda la lógica relacionada con las llamadas a la API y la mutación del estado (`state.budgets`).
   - Este servicio maneja la creación (`createBudget`), actualización (`updateBudget`) y eliminación (`deleteBudget`) de los presupuestos.
   - También maneja la persistencia local de los presupuestos (`saveBudgetsLocal`) y la inicialización (`initBudgets`).

2. **Actualización de `js/budgets.js`**:
   - Se removió toda la lógica de mutación de estado directa y llamadas a `apiFetch`.
   - Se reemplazaron por llamadas a las funciones correspondientes importadas de `budgetService.js` (ej. `budgetService.createBudget()`, `budgetService.updateBudget()`, `budgetService.deleteBudget()`).
   - De esta manera, `js/budgets.js` ahora funciona puramente como la capa de Interfaz de Usuario (UI) y manipulación del DOM, encargándose únicamente de renderizar la vista y manejar los eventos de la vista, delegando la responsabilidad de datos y red al servicio.

## Beneficios
- **Mantenibilidad**: La separación de responsabilidades facilita encontrar y arreglar errores, o realizar cambios a futuro.
- **Desacoplamiento**: La capa visual ahora es independiente de cómo se comunican y almacenan los datos.
- **Cumplimiento de SOLID y PHAME**: Se respeta el Principio de Responsabilidad Única (SRP).
