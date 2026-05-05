# 💳 Investigación: Integración Mercado Pago

Para lograr que la app "Flujo" detecte tus pagos automáticamente, necesitamos conectarnos a la API de Mercado Pago. Aquí está el detalle técnico para implementarlo.

## 1. API de Referencia
El endpoint principal que utilizaremos es:
`GET https://api.mercadopago.com/v1/payments/search`

Este endpoint permite buscar transacciones filtrando por:
- `range`: fecha de creación (para no traer todo cada vez).
- `status`: solo traer "approved".
- `operation_type`: filtrar compras, transferencias, etc.

## 2. Autenticación (El punto crítico)
Mercado Pago requiere un `access_token` en el Header:
`Authorization: Bearer YOUR_ACCESS_TOKEN`

### Riesgo de Seguridad
Como "Flujo" es una app 100% frontend por ahora, poner el token en el código es peligroso. 
**Recomendación para el estudiante:** Agregaremos una sección de "Configuración" en la UI donde el usuario pegue su propio Access Token (obtenido de MP Developers). La app lo guardará en `localStorage` para uso local.

## 3. Mapeo de Datos
Debemos convertir la respuesta de MP a nuestra entidad `Transaction`:

| Campo MP (`results[i]`) | Campo Flujo | Observación |
|-------------------------|-------------|-------------|
| `transaction_amount`    | `amount`    | Monto de la operación |
| `description`           | `desc`      | Detalle del pago |
| `date_approved`         | `date`      | Fecha de confirmación |
| `operation_type`        | `type`      | Mapear a 'expense' o 'income' |

## 4. Diseño Hexagonal (Nuevos Archivos)

- **Dominio:** `src/domain/services/MpTransactionMapper.js` (Lógica para convertir JSON de MP a Transacción).
- **Aplicación:** `src/application/ports/MpPort.js` e `src/application/usecases/SyncMpUseCase.js`.
- **Infraestructura:** `src/infrastructure/adapters/MpRestAdapter.js` (Usa `fetch` para llamar a la API).
- **UI:** Un botón de "Sincronizar Mercado Pago" en la vista de transacciones.

## Próximos Pasos
1. Crear el Puerto y el Adaptador de MP.
2. Implementar el mapeo de categorías inteligente.
3. Agregar la configuración en la UI para el Token.
