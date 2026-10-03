# Diagnóstico Integral y Roadmap: ¿Qué le falta a la Sección Cuentas?

Este documento presenta una auditoría técnica profunda y un plan maestro de evolución para el módulo de **Cuentas** (`Accounts`) del Gestor de Finanzas. El análisis abarca la perspectiva contable/fintech, la experiencia de usuario (UI/UX), la arquitectura de software (**SOLID**, **PHAME**, Clean Architecture) y la integridad de datos.

---

## 1. Resumen Ejecutivo del Diagnóstico

Actualmente, la sección de Cuentas cuenta con una base sólida tras el refactor inicial a TypeScript y la separación en `accountService.ts`:
- Permite gestionar múltiples cuentas agrupadas por tipo (`banco`, `ahorro`, `efectivo`, `tarjeta`, `inversión`, `digital`, `custom`).
- Soporte multidivisa básico (`ARS`, `USD`, `EUR`) y cotización en vivo con `dolarapi.com`.
- Integración de billeteras digitales con OAuth/Token (Mercado Pago, Plaid, Belvo).
- Visualización de movimientos recientes y cálculo de patrimonio neto desglosado.

Sin embargo, frente a aplicaciones financieras de clase mundial (como *YNAB*, *Wallet by BudgetBakers*, *Monefy*, *Revolut* o *Mobills*), la sección adolece de **brechas funcionales, limitaciones ergonómicas y oportunidades arquitectónicas clave**.

---

## 2. Brechas Funcionales y Financieras (Core Fintech)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   BRECHAS FINANCIERAS PRINCIPALES                     │
├─────────────────────────┬──────────────────────┬───────────────────────┤
│ 1. Conciliación         │ 2. Soft-Delete       │ 3. Tarjetas de Crédito│
│    Ajuste de saldo      │    Archivado sin     │    Cierre, vencimiento│
│    con asiento contable │    borrar historial  │    y botón de pago    │
├─────────────────────────┼──────────────────────┼───────────────────────┤
│ 4. Datos Bancarios      │ 5. Patrimonio Neto   │ 6. Transferencias     │
│    Alias, CBU/CVU y     │    Consolidado total │    Atómicas en Backend│
│    copia en un clic     │    a valor de cambio │    con rollback ACID  │
└─────────────────────────┴──────────────────────┴───────────────────────┘
```

### 2.1. Conciliación y Ajuste Rápido de Saldo (Reconciliation Accounting)
- **Problema:** En el mundo real, los saldos en efectivo o en cuentas bancarias a menudo difieren del balance registrado en la app (debido a propinas, gastos pequeños no anotados, redondeos o comisiones bancarias). Hoy, la única forma de corregirlo es editar manualmente el saldo en el modal de cuenta.
- **Defecto Contable:** Al sobrescribir el saldo, se pierde la trazabilidad de la auditoría. No queda registro contable de por qué cambió el saldo.
- **Lo que falta:** Un botón de **"Conciliar / Ajustar Saldo"**:
  1. El usuario ingresa el saldo real actual según su home banking o billetera.
  2. El sistema calcula la diferencia:
     $$\Delta = \text{Saldo Real} - \text{Saldo Actual}$$
  3. Se genera automáticamente una transacción de ajuste de balance etiquetada como *"Ajuste de conciliación"* (tipo Ingreso si $\Delta > 0$, Gasto si $\Delta < 0$) con categoría *"Ajuste de Saldo"*, preservando la coherencia histórica.

### 2.2. Archivado de Cuentas (Soft Delete vs. Eliminación Destructiva)
- **Problema:** Cuando un usuario deja de usar una cuenta (ej. cerró una cuenta bancaria, dio de baja una tarjeta de crédito o finalizó un plazo fijo), su única opción es "Eliminar cuenta".
- **Defecto Crítico:** En `api/services/account_service.py`, al eliminar una cuenta se ejecuta:
  ```python
  self.tx_repo.delete_by_account_id(account_id, user_id)
  ```
  Esto **borra permanentemente todas las transacciones históricas** de esa cuenta, distorsionando y rompiendo los reportes anuales y estadísticas de gastos pasados.
- **Lo que falta:** Soporte para `is_archived: bool`. Una cuenta archivada se oculta de la vista cotidiana y de los selectores de transacciones, pero **conserva intacto el 100% de su historial financiero**.

### 2.3. Tarjetas de Crédito de Primera Clase (Ciclos de Facturación)
- **Problema:** Actualmente las tarjetas de crédito son tratadas casi como una cuenta bancaria estándar con un campo `limit`.
- **Lo que falta:**
  - **Día de Cierre de Resumen (`closing_day`, ej: día 20):** Permite calcular si una compra entra en el resumen del mes corriente o del siguiente.
  - **Día de Vencimiento de Pago (`due_day`, ej: día 5):** Permite generar alertas de vencimiento de tarjeta antes de devengar intereses punitorios.
  - **Botón "Pagar Tarjeta / Resumen":** Genera una transferencia directa desde una cuenta bancaria de débito a la tarjeta para saldar el saldo acumulado en 1 clic.

### 2.4. Datos Bancarios Útiles (CBU, CVU, Alias y Copia Rápida)
- **Problema:** Los usuarios frecuentemente necesitan compartir su Alias o CBU/CVU para recibir transferencias. Hoy deben salir de la aplicación para buscarlo en su app bancaria.
- **Lo que falta:** Campos opcionales `alias` y `cbu_cvu` en la cuenta, con un botón interactivo de **"Copiar Alias / CBU al portapapeles"** en el panel de detalle.

### 2.5. Consolidación Total del Patrimonio Neto (Net Worth Unificado)
- **Problema:** El componente de patrimonio neto muestra los saldos separados por moneda: `$1.500.000 + US$ 2.000 + € 300`. No existe un valor patrimonial total unificado.
- **Lo que falta:** Un selector o valor total estimado consolidado:
  $$\text{Patrimonio Consolidado (ARS)} = \text{Saldo ARS} + (\text{Saldo USD} \times \text{Cotización Blue}) + (\text{Saldo EUR} \times \text{Cotización Euro})$$
  Aprovechando que el sistema ya cuenta con integración reactiva a `dolarapi.com`.

---

## 3. Experiencia de Usuario e Interfaz (UI / UX)

### 3.1. Movimientos de la Cuenta: Paginación, Búsqueda y Enlace Directo
- **Problema:** En `js/accounts.ts`, los movimientos de la cuenta seleccionada están limitados de forma rígida a los primeros 15 registros mediante `.slice(0, 15)`.
- **Lo que falta:**
  - Un mini-buscador por texto dentro del panel de movimientos.
  - Un enlace/botón: *"Ver todos los movimientos en Transacciones"*, que navegue a la pestaña de transacciones aplicando automáticamente el filtro de dicha cuenta.
  - Paginación o scroll dinámico para explorar el historial completo de la cuenta.

### 3.2. Personalización Visual (Color e Ícono por Cuenta)
- **Problema:** Los colores e íconos son estáticos por categoría de cuenta. Si un usuario tiene tres cuentas bancarias (ej. Banco Santander, BBVA y Banco Galicia), las 3 tarjetas son del mismo color azul con el emoji 🏦.
- **Lo que falta:** Permitir asignar un color y un icono/emoji propio a cada cuenta para distinguirlas visualmente al instante.

### 3.3. Cuentas Favoritas o Fijadas (Pinning)
- **Problema:** El orden de las cuentas es el que devuelve la base de datos (por ID).
- **Lo que falta:** Marcar una cuenta como "Principal / Favorita", garantizando que aparezca primera en la grilla y sea la seleccionada por defecto al registrar transacciones.

### 3.4. Gráfico de Evolución Patrimonial por Cuenta (Sparkline / Tendencia)
- **Problema:** El panel de detalle muestra estadísticas estáticas (total ingresos, total gastos).
- **Lo que falta:** Un mini-gráfico (sparkline o gráfico de barras mensual) que ilustre la tendencia del saldo en los últimos 6 meses para identificar si la cuenta está en crecimiento o en desahorro.

### 3.5. Responsive Design en Pantallas Medianas y Móviles
- **Problema en `css/views/accounts.css`:**
  - `.cv-top-grid` define `grid-template-columns: repeat(3, 1fr);` fijo.
  - `.cv-main-grid` define `grid-template-columns: 1fr 340px;` fijo.
- **Lo que falta:** Implementar `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));` y media queries para pantallas `< 900px` y `< 600px` que apilen el panel de transferencias y detalles en una sola columna fluida.

---

## 4. Arquitectura de Software y Backend (SOLID & PHAME)

### 4.1. Transferencias Atómicas en Backend (Transacciones ACID)
- **Problema en `accountService.ts`:**
  ```typescript
  // Ejecuta dos peticiones HTTP independientes:
  await apiFetch('/transactions', { method: 'POST', body: JSON.stringify(expense) });
  await apiFetch('/transactions', { method: 'POST', body: JSON.stringify(income) });
  ```
  Si la segunda llamada falla por pérdida de conectividad o error 500, la transferencia queda desbalanceada: el dinero se debitó de la cuenta origen pero nunca ingresó en la de destino.
- **Solución Arquitectónica:**
  Implementar el caso de uso `transfer_between_accounts` con un endpoint atómico `POST /api/accounts/transfer` que ejecute débito, crédito y creación de transacciones dentro de una única transacción SQLAlchemy:
  ```python
  with db.begin():
      # Debit from source account
      # Credit to target account
      # Create expense transaction
      # Create income transaction
      # If anything fails, rollback automático
  ```

### 4.2. Inconsistencia de Capas en `api/routers/accounts.py`
- **Problema:** Mientras que `create_account` y `delete_account` delegan correctamente a `AccountService` inyectado mediante interfaces de repositorio, los endpoints `update_account_token` y `sync_account_transactions` todavía hacen queries directas contra `db.query(Account)` y `db.query(WalletConnection)`.
- **Solución:** Mover toda la lógica de sincronización y credenciales al `AccountService`, manteniendo el router puramente como adaptador de entrada HTTP (Clean Architecture).

---

## 5. Resumen Comparativo de Madurez por Módulo

| Característica | Presupuestos (Post-Mejora) | Objetivos (Post-Mejora) | Cuentas (Estado Actual) | Cuentas (Objetivo Propuesto) |
| :--- | :---: | :---: | :---: | :---: |
| **Soporte Multidivisa** | ✅ ARS / USD / EUR | ✅ ARS / USD / EUR | ⚠️ Parcial (desglosado sin total) | 🎯 Consolidación unificada |
| **Filtros y Búsqueda** | ✅ Filtros y Orden | ✅ Filtros y Orden | ❌ Sin filtros ni búsqueda | 🎯 Búsqueda, archivadas y orden |
| **Proyecciones / Ritmo** | ✅ Burn rate y ritmo | ✅ Ritmo temporal | ❌ Solo balance estático | 🎯 Tendencia y ciclo de tarjeta |
| **Integridad Transaccional** | ✅ Validaciones | ✅ Conciliación con Cuentas | ⚠️ 2 llamadas HTTP en transferencias | 🎯 Endpoint atómico ACID |
| **Soft Delete** | ❌ (No aplica) | ✅ Pausar / Reactivar | ❌ Borrado destructivo en cascada | 🎯 Archivado de cuenta |
| **Ergonomía / Utilidad** | ✅ Alerta de impacto | ✅ Aportes y Retiros | ⚠️ Datos básicos | 🎯 CBU/Alias copia rápida + conciliación |
