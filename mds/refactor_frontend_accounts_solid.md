# Refactor Frontend - Accounts (SOLID & PHAME)

## Objetivo
Refactorizar la lógica de `js/accounts.js` para cumplir con los principios SOLID (específicamente SRP - Principio de Responsabilidad Única) y el framework PHAME. El objetivo principal es separar las llamadas a la API (backend) y la manipulación del estado (`state.accounts`), dejando a `js/accounts.js` puramente como una capa de manipulación del DOM y de la Interfaz de Usuario (UI).

## Cambios Realizados

1. **Creación de `js/services/accountService.js`:**
   - Se creó un nuevo servicio dedicado a la lógica de negocio y las comunicaciones con el backend respecto a las Cuentas.
   - Se movieron todas las funciones que realizan `apiFetch` (ej. `saveMpToken`, `syncWallet`, `updateAccountBalance`, `getWalletStatus`, `disconnectWallet`, `cleanupDuplicates`, `getSuggestedExchangeRate`, `doTransfer`, `saveAccount`, `deleteAccount`).
   - Se movieron las mutaciones directas al estado global relacionadas con cuentas (`state.accounts` y en algunos casos `state.transactions` para transferencias) hacia este servicio.
   - Centralización del manejo de LocalStorage para cuentas (`saveAccounts` y `initAccounts`).

2. **Refactorización de `js/accounts.js`:**
   - Se eliminaron las llamadas directas a `apiFetch`.
   - Se importó `accountService` desde `js/services/accountService.js`.
   - Se actualizaron todas las funciones asíncronas para que actúen como intermediarios que capturan eventos de la interfaz, delegan la lógica pesada a `accountService`, y luego reaccionan a las respuestas actualizando el DOM (ej. con `renderCuentasView`, `showToast`, y cierres de modales).
   - Se mantuvo la responsabilidad estricta de actualizar visualmente los selectores, tarjetas de cuenta y balances.

## Beneficios
- **Cumplimiento de SRP:** `js/accounts.js` ahora solo se preocupa por la UI. `accountService.js` se encarga de la comunicación con la API y la gestión del estado.
- **Mantenibilidad:** Si cambian las rutas del backend o la estructura del estado, solo se requiere modificar el servicio.
- **Testabilidad:** La lógica de negocio y la lógica de presentación ahora se pueden probar por separado.
