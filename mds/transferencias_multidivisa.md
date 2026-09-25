# Transferencias Multidivisa y Gestión Contable

Este documento explica en detalle la arquitectura, lógica de negocio y funcionamiento de las transferencias entre cuentas con diferentes divisas en el Gestor de Finanzas.

---

## 1. El problema de la paridad 1:1 (Contexto Histórico)

Originalmente, el sistema permitía crear cuentas con divisas como Pesos (`ARS`), Dólares (`USD`) y Euros (`EUR`), pero el módulo de transferencias operaba bajo una suposición errónea:
* Se solicitaba un único campo de **"Monto ($)"**.
* Al transferir entre cuentas, el sistema restaba esa cantidad de la cuenta origen y sumaba la **misma cantidad numérica** en la cuenta destino.

### Impacto del error:
1. **De Dólares a Pesos:** Si el usuario transfería **100 USD** de una cuenta de ahorros en dólares a su cuenta de Mercado Pago en pesos, el sistema debitaba 100 USD pero acreditaba únicamente **$100 ARS** (en vez de ~$130.000 ARS).
2. **De Pesos a Dólares:** Si transfería **$130.000 ARS** a su cuenta en dólares, la cuenta en dólares recibía **130.000 USD**.

---

## 2. Solución Implementada: Transferencia Inteligente Multidivisa

Se implementó un motor adaptativo que detecta en tiempo real si las cuentas seleccionadas (Origen y Destino) comparten la misma moneda o difieren.

### A. Mismo tipo de divisa (ARS → ARS, USD → USD, EUR → EUR)
* La interfaz se mantiene minimalista y ágil.
* Se solicita el **Monto a transferir** en la divisa correspondiente.
* Se debita y acredita el mismo importe sin fricción innecesaria.

### B. Distinta divisa (USD ↔ ARS, EUR ↔ ARS, USD ↔ EUR)
Al detectar que `fromAcc.currency !== toAcc.currency`:
1. El formulario despliega suavemente la tarjeta **"💱 Conversión de Divisas"**.
2. Los campos se adaptan con la simbología y moneda correspondiente:
   * **Monto a debitar:** Monto en la divisa de origen (ej: `100 USD`).
   * **Cotización:** Tasa de cambio entre las dos monedas (ej: `1 USD = $1.540 ARS`).
   * **Monto a recibir:** Monto calculado en la divisa de destino (ej: `$154.000 ARS`).
3. **Cálculo bidireccional en tiempo real:**
   * Si el usuario escribe el monto a debitar y la cotización, se calcula automáticamente el monto a recibir.
   * Si el usuario escribe el monto que recibió en su banco destino, se calcula automáticamente la cotización implícita de la operación.
4. **Cotización sugerida en vivo (API):**
   * Botón `⚡ Cotización sugerida` conectado a `https://dolarapi.com/v1/dolares/blue` y `cotizaciones/eur`.
   * Identifica el sentido de la operación: si el usuario vende divisas usa cotización de compra; si compra divisas usa cotización de venta.
5. **Resumen visual en tiempo real:**
   * Muestra un panel de confirmación claro:
     `💡 Débito: US$ 100 (Ahorros USD) → Crédito: $ 154.000 (Mercado Pago) [Tasa: 1 USD = $1.540 ARS]`.

---

## 3. Modelo Contable en Base de Datos

Cada transferencia genera **dos registros atómicos en la tabla `transactions`**, vinculados por un identificador común:

| Campo | Transacción 1 (Egreso) | Transacción 2 (Ingreso) |
| :--- | :--- | :--- |
| `account_id` | Cuenta Origen (`fromId`) | Cuenta Destino (`toId`) |
| `type` | `expense` | `income` |
| `amount` | `amountFrom` (en moneda origen) | `amountTo` (en moneda destino) |
| `desc` | `Paso a ahorro → Mercado Pago (1 USD = $1.540 ARS)` | `Paso a ahorro ← Ahorros USD (1 USD = $1.540 ARS)` |
| `transfer_id` | `linkId` (mismo timestamp) | `linkId` (mismo timestamp) |
| `cat` | `Otros` | `Otros` |

### Integridad con el Backend
El endpoint `POST /transactions` de la API actualiza los saldos de cada cuenta según el `amount` de su respectiva transacción:
* `fromAcc.balance -= amountFrom`
* `toAcc.balance += amountTo`
Esto garantiza que la cuenta en dólares disminuya en dólares y la cuenta en pesos aumente en pesos.

---

## 4. Consolidación del Patrimonio Neto

En la cabecera de la vista de cuentas (`renderCvWorth`):
* Se calcula el subtotal de cada divisa de forma independiente (`arsTotal`, `usdTotal`, `eurTotal`).
* Se muestra el desglose exacto:
  `$ 1.250.000 + US$ 1.500,00 + € 200,00`
* Cada tarjeta de cuenta y chip de detalle utiliza `formatMoney(balance, currency)` mostrando los símbolos correctos:
  * ARS: `$`
  * USD: `US$`
  * EUR: `€`
