# Evolución y Mejoras de la Sección de Cuentas

Este documento detalla la reingeniería y ampliación de capacidades del módulo de **Cuentas** (`Accounts`), tanto a nivel de backend (FastAPI / SQLAlchemy / Arquitectura Hexagonal) como de frontend (TypeScript / Vite / CSS Modular), orientadas a la integridad transaccional ACID, soporte multidivisa consolidado, conciliación contable de saldos y la adherencia estricta a los principios **SOLID** y arquitectura **PHAME**.

---

## 1. Problemas y Carencias Resueltas

1. **Falta de Conciliación y Ajuste de Saldos:**
   - Anteriormente, para ajustar el saldo de una cuenta por comisiones bancarias, propinas o pequeños gastos en efectivo, el usuario sobreescribía el saldo en la edición de cuenta. Esto destruía la trazabilidad de la auditoría.
   - **Solución:** Se implementó el flujo de **Conciliación de Saldo**: el usuario ingresa el saldo real de su banco o billetera, el sistema calcula la diferencia ($\Delta = \text{Saldo Real} - \text{Saldo Actual}$) y crea automáticamente un asiento contable de tipo *Ajuste de Saldo* (Ingreso o Gasto).

2. **Borrado Destructivo en Cascada de Historial Financiero:**
   - Anteriormente, eliminar una cuenta ejecutaba `delete_by_account_id`, destruyendo todas las transacciones históricas asociadas a esa cuenta y corrompiendo los reportes anuales pasados.
   - **Solución:** Se implementó el estado `is_archived: bool` (*Soft Delete*). Una cuenta archivada se oculta del día a día y de los selectores de transferencias/transacciones, pero preserva el 100% de su historial financiero.

3. **Inconsistencia y Riesgo en Transferencias entre Cuentas:**
   - En la versión previa, una transferencia se procesaba mediante dos llamadas HTTP separadas desde el cliente. Si la segunda fallaba, la transferencia quedaba desbalanceada (dinero debitado pero nunca acreditado).
   - **Solución:** Se creó el endpoint atómico `POST /api/accounts/transfer` que procesa el débito, el crédito y la creación de ambas transacciones dentro de una única transacción SQL con rollback automático ante cualquier excepción.

4. **Gestión Integral de Tarjetas de Crédito:**
   - Se incorporaron los campos `closing_day` (día de cierre) y `due_day` (día de vencimiento).
   - Se añadió la acción directa **"💳 Pagar Resumen"** en el panel de detalle, que preconfigura la transferencia desde una cuenta con saldo disponible hacia la tarjeta por el monto adeudado.

5. **Datos Bancarios de Uso Cotidiano:**
   - Se agregaron los campos `alias` y `cbu` con botones de **"Copiar al portapapeles"** en 1 clic desde el detalle de la cuenta.

6. **Consolidación Total del Patrimonio Neto en Moneda Base:**
   - El componente de patrimonio neto ahora permite alternar entre el desglose por moneda y el **Patrimonio Consolidado Estimado en ARS**, calculando las cuentas en USD y EUR según la cotización del dólar blue y euro en tiempo real provistas por `dolarapi.com`.

7. **Búsqueda, Filtros y Paginación:**
   - Toolbar con pestañas: `Activas`, `Archivadas`, `Todas`.
   - Buscador reactivo por nombre, banco, alias o CBU.
   - Las cuentas marcadas como **Favoritas ⭐** se posicionan automáticamente primero.
   - Buscador reactivo de movimientos por descripción o categoría dentro del panel de la cuenta y botón directo para *"Ver todas en Transacciones ↗"*.

8. **Diseño Responsive:**
   - Grid dinámico `repeat(auto-fill, minmax(280px, 1fr))` y adaptación móvil en `css/views/accounts.css`.

---

## 2. Cambios Técnicos Implementados

### A. Backend y Persistencia
- **Modelo de Datos (`api/models.py`):**
  - Nuevas columnas en `accounts`: `is_archived`, `is_favorite`, `color`, `icon`, `cbu`, `alias`, `closing_day`, `due_day`.
- **Migración Automática Idempotente (`api/main.py`):**
  - Ampliación de `migrate_schema_columns()` para incorporar las nuevas columnas mediante `ALTER TABLE` sin pérdida de datos.
- **Esquemas DTO (`api/schemas.py`):**
  - Extensión de `AccountCreate` y `AccountUpdate`.
  - Creación de `AccountTransferRequest` y `AccountReconcileRequest`.
- **Capa de Servicio (`api/services/account_service.py`):**
  - Nuevos métodos: `transfer_between_accounts`, `reconcile_balance`, `toggle_archive`, `toggle_favorite`.
- **Enrutador (`api/routers/accounts.py`):**
  - Nuevos endpoints: `POST /api/accounts/transfer`, `POST /api/accounts/{id}/reconcile`, `PATCH /api/accounts/{id}/archive`, `PATCH /api/accounts/{id}/favorite`.
- **Pruebas Unitarias (`api/tests/test_accounts.py`):**
  - 100% de cobertura verde en las 28 pruebas de la suite backend.

### B. Frontend y UI Modular
- **Servicio (`js/services/accountService.ts`):**
  - Transferencias atómicas vía backend con fallback local, `toggleArchive`, `toggleFavorite`, `reconcileAccount`.
- **Controlador de UI (`js/accounts.ts`):**
  - Búsqueda, filtrado por pestañas, renderizado adaptativo, modal de conciliación, atajo de pago de tarjeta y copiado rápido.
- **Vista HTML (`html/views/cuentas.html`):**
  - Toolbar reactivo, switch de consolidación, panel de movimientos con filtro.
- **Modales (`main.html`):**
  - Modal ampliado de cuenta (Alias, CBU, Color, Ícono, Ciclo de tarjeta, Favorita) y modal dedicado de conciliación de saldo (`#accReconcileOverlay`).
- **Estilos Modulares (`css/views/accounts.css`):**
  - Reglas CSS para toolbars, botones de copiado, badges y media queries fluidas.

---

## 3. Principios SOLID y PHAME Aplicados

- **Single Responsibility Principle (SRP):**
  - `accountService.ts` administra la persistencia y llamadas HTTP.
  - `accounts.ts` gobierna exclusivamente la presentación en el DOM y eventos de usuario.
  - `AccountService` en backend concentra las reglas de negocio y transacciones contables.
- **Dependency Inversion Principle (DIP):**
  - `AccountService` opera contra abstracciones (`IAccountRepository`, `ITransactionRepository`), sin acoplamiento a detalles de infraestructura.
- **Clean Architecture & PHAME:**
  - Estricta separación entre vistas, hojas de estilo desacopladas y controladores cliente/servidor.
