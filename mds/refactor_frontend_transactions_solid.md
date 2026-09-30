# Refactorización del Frontend: Módulo de Transacciones (SOLID & PHAME)

Como parte del Plan de Mantenibilidad y Arquitectura PHAME, se ha estructurado y corregido el módulo de transacciones en el frontend (`js/transactions.ts`, `js/ui.ts`, `js/types.ts`).

## ¿Qué se hizo?

1. **Creación de `TransactionService` (`js/services/transactionService.ts`)**:
   - Se ha extraído toda la lógica relacionada con operaciones de datos, mutación del estado global (`state.transactions`) y llamadas a la API (`apiFetch`).
   - Se crearon los métodos `addTransaction`, `updateTransaction` y `deleteTransaction`.
   - **PHAME aplicado (Modularidad y Abstracción)**: Ahora el servicio encapsula cómo se guardan o editan las transacciones en el servidor y en local, ocultando esta complejidad a la vista.

2. **Refactorización de `js/transactions.ts`**:
   - Se modificaron las funciones `addTransaction`, `saveEdit` y `doDelete` para delegar el trabajo a `TransactionService`.
   - **SOLID aplicado (Responsabilidad Única)**: El archivo `transactions.ts` tiene la responsabilidad de gestionar la Interfaz de Usuario (UI), el DOM, la validación visual y las renderizaciones (`renderTxView()`, `showToast()`).

3. **Corrección de Ciclo de Vida y Encapsulamiento de Vista (`enterTxView`)**:
   - **Diagnóstico del problema**: Al sincronizar Mercado Pago, los movimientos aparecían correctamente en la vista de "Cuentas" (50 transacciones), pero al hacer clic en "Transacciones" en la barra lateral, la tabla aparecía vacía con "0 transacciones".
   - **Causa raíz técnica**: En `js/ui.ts`, al cambiar a la página `'transacciones'`, se realizaba una asignación directa a variables de módulo no declaradas en ese archivo:
     ```javascript
     txFilter = { type: 'all', ... }; // ❌ Uncaught ReferenceError: txFilter is not defined
     ```
     En módulos ES (estrictos por especificación), esto producía una excepción inmediata que detenía la ejecución del script antes de que `renderTxView()` pudiera ejecutarse.
   - **Solución arquitectónica (SOLID / PHAME)**:
     - Se creó la función `enterTxView()` exportada en `js/transactions.ts`, que centraliza el reinicio seguro de filtros, la sincronización de la interfaz y la renderización de la tabla.
     - `js/ui.ts` ahora simplemente delega en `enterTxView()`, siguiendo el mismo patrón de diseño limpio que `enterCuentasView()` o `enterBudgetView()`.
     - Se añadió protección contra nulos en `getFilteredTx()`, `renderTxView()` y `syncTxFilterUI()` para que toleren transacciones con descripciones o categorías atípicas.
     - Se actualizaron las categorías en `html/views/transactions.html` para que coincidan con las del clasificador inteligente de Mercado Pago (`Ingresos (Sueldo/Freelance)`, `Supermercado / Almacén`, etc.).
     - En `js/accounts.ts`, tras guardar el saldo inicial de Mercado Pago, se dispara automáticamente la sincronización inicial de movimientos para que el usuario no deba pulsar "Sincronizar Billetera" manualmente.

## Beneficios
- **Mayor Mantenibilidad**: Ciclo de vida desacoplado y sin variables globales mutadas fuera de su módulo de origen.
- **Experiencia de Usuario Fluida**: Al conectar la billetera y asignar el saldo inicial, las transacciones se sincronizan y aparecen de inmediato tanto en Cuentas como en la tabla global de Transacciones.
- **Robustez**: Eliminación definitiva del `ReferenceError` y tolerancia ante valores indefinidos o nulos.
