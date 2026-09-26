# Refactorización del Frontend: Módulo de Transacciones (SOLID & PHAME)

Como parte de la Fase 2 (Modularización y Abstracción) y Fase 3 (Responsabilidad Única) del Plan de Mantenibilidad, se ha refactorizado el archivo `js/transactions.js`.

## ¿Qué se hizo?

1. **Creación de `TransactionService` (`js/services/transactionService.js`)**:
   - Se ha extraído toda la lógica relacionada con operaciones de datos, mutación del estado global (`state.transactions`) y llamadas a la API (`apiFetch`).
   - Se crearon los métodos `addTransaction`, `updateTransaction` y `deleteTransaction`.
   - **PHAME aplicado (Modularidad y Abstracción)**: Ahora el servicio encapsula cómo se guardan o editan las transacciones en el servidor y en local, ocultando esta complejidad a la vista.

2. **Refactorización de `js/transactions.js`**:
   - Se modificaron las funciones `addTransaction`, `saveEdit` y `doDelete` para delegar el trabajo a `TransactionService`.
   - **SOLID aplicado (Responsabilidad Única)**: El archivo `transactions.js` ahora tiene una única responsabilidad: gestionar la Interfaz de Usuario (UI), el DOM, la validación visual y las renderizaciones (`renderTxView()`, `showToast()`).
   - Ya no realiza peticiones HTTP directas ni manipula `state.transactions`.

## Beneficios
- **Mayor Mantenibilidad**: Si en el futuro cambiamos cómo se sincronizan las transacciones (por ejemplo, con WebSockets o IndexedDB), solo se debe modificar `TransactionService`.
- **Código más limpio**: Las funciones en `transactions.js` son más cortas y su propósito visual/interactivo es claro.
