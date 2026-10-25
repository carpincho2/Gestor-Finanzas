# Reporte Oficial de Deuda Técnica y Mantenibilidad

Generado automáticamente aplicando las **7 fórmulas oficiales** sobre el código fuente real del proyecto (excluyendo `venv`, `fluxo_venv`, `node_modules` y artefactos compilados).

## Glosario y Parámetros Globales
- **K (Factor de corrección):** `0.01`
- **Salario por Hora:** `$20.00 USD`
- **Horas por Mes:** `160 hs`
- **Interés Anual por Módulo:** `$1400.00 USD` ($10 \times (14 - 7) \times \text{Salario}$)

## Resumen Ejecutivo del Proyecto
- **Archivos Analizados:** `137` (`20,382` LOC efectivos)
- **Índice de Mantenibilidad Promedio (MI):** `33.59`
- **Deuda Técnica Total:** `12214.14 horas` (`76.34 meses`)
- **Costo Total de Reparación:** `$244,282.61 USD`

## Backend (Python) (73 archivos)

| Archivo | LOC | G | 1. MI | 2. Deuda (Hs) | 3. Costo ($) | 4. Meses | 5. Interés Anual | 6. Payback (Años) | 7. ROI (%) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `api/wallet_adapters/mercadopago_adapter.py` | 360 | 65 | 5.20 🔴 | 251.27 hs | $5,025.37 | 1.57 m | $1,400 | 3.59 a | -44.3% |
| `api/services/sepa/comparador.py` | 303 | 45 | 10.41 🔴 | 195.70 hs | $3,913.96 | 1.22 m | $1,400 | 2.80 a | -28.5% |
| `api/services/recommendation.py` | 292 | 63 | 8.53 🔴 | 194.08 hs | $3,881.68 | 1.21 m | $1,400 | 2.77 a | -27.9% |
| `api/routers/wallets.py` | 265 | 46 | 12.24 🔴 | 166.32 hs | $3,326.39 | 1.04 m | $1,400 | 2.38 a | -15.8% |
| `api/routers/accounts.py` | 235 | 36 | 15.34 🔴 | 140.20 hs | $2,804.05 | 0.88 m | $1,400 | 2.00 a | -0.1% |
| `api/tests/test_sepa.py` | 240 | 1 | 19.74 🔴 | 132.63 hs | $2,652.52 | 0.83 m | $1,400 | 1.89 a | 5.6% |
| `api/services/auth_service.py` | 205 | 46 | 15.99 🔴 | 120.97 hs | $2,419.37 | 0.76 m | $1,400 | 1.73 a | 15.7% |
| `api/services/shopping/generic_extractor.py` | 184 | 84 | 12.46 🔴 | 115.07 hs | $2,301.47 | 0.72 m | $1,400 | 1.64 a | 21.7% |
| `api/services/shopping_service.py` | 191 | 51 | 16.35 🔴 | 112.02 hs | $2,240.33 | 0.70 m | $1,400 | 1.60 a | 25.0% |
| `api/services/ai_service.py` | 185 | 44 | 17.76 🔴 | 105.89 hs | $2,117.85 | 0.66 m | $1,400 | 1.51 a | 32.2% |
| `api/routers/sepa.py` | 194 | 9 | 21.77 🔴 | 103.26 hs | $2,065.17 | 0.65 m | $1,400 | 1.48 a | 35.6% |
| `api/models.py` | 187 | 1 | 23.39 🔴 | 96.52 hs | $1,930.31 | 0.60 m | $1,400 | 1.38 a | 45.1% |
| `api/services/shopping/mercadolibre_extractor.py` | 162 | 75 | 15.53 🔴 | 96.34 hs | $1,926.76 | 0.60 m | $1,400 | 1.38 a | 45.3% |
| `api/infrastructure/repositories/sqlalchemy_price_repository.py` | 178 | 24 | 21.01 🔴 | 96.09 hs | $1,921.87 | 0.60 m | $1,400 | 1.37 a | 45.7% |
| `api/seed_dummy.py` | 180 | 13 | 22.33 🔴 | 94.80 hs | $1,896.08 | 0.59 m | $1,400 | 1.35 a | 47.7% |
| `api/alembic/versions/4faf7655fc78_baseline_migration.py` | 181 | 1 | 23.86 🔴 | 92.56 hs | $1,851.12 | 0.58 m | $1,400 | 1.32 a | 51.3% |
| `api/services/sepa/loader.py` | 166 | 30 | 21.23 🔴 | 89.26 hs | $1,785.22 | 0.56 m | $1,400 | 1.28 a | 56.8% |
| `api/services/account_service.py` | 163 | 36 | 20.69 🔴 | 88.53 hs | $1,770.58 | 0.55 m | $1,400 | 1.26 a | 58.1% |
| `api/services/goal_service.py` | 158 | 47 | 19.66 🔴 | 87.43 hs | $1,748.62 | 0.55 m | $1,400 | 1.25 a | 60.1% |
| `api/main.py` | 159 | 14 | 24.01 🔴 | 81.07 hs | $1,621.48 | 0.51 m | $1,400 | 1.16 a | 72.7% |
| `api/services/transaction_service.py` | 126 | 27 | 25.66 🔴 | 62.17 hs | $1,243.30 | 0.39 m | $1,400 | 0.89 a | 125.2% |
| `api/tests/test_accounts.py` | 131 | 5 | 28.05 🔴 | 61.50 hs | $1,230.02 | 0.38 m | $1,400 | 0.88 a | 127.6% |
| `api/routers/auth.py` | 125 | 15 | 27.39 🔴 | 59.51 hs | $1,190.17 | 0.37 m | $1,400 | 0.85 a | 135.3% |
| `api/schemas.py` | 117 | 1 | 30.24 🔴 | 52.37 hs | $1,047.31 | 0.33 m | $1,400 | 0.75 a | 167.4% |
| `api/tests/test_goals.py` | 110 | 1 | 31.15 🔴 | 48.24 hs | $964.81 | 0.30 m | $1,400 | 0.69 a | 190.2% |
| `api/infrastructure/migrations.py` | 103 | 13 | 30.49 🔴 | 45.84 hs | $916.86 | 0.29 m | $1,400 | 0.65 a | 205.4% |
| `api/services/sepa/promociones.py` | 95 | 11 | 31.94 🔴 | 40.90 hs | $818.08 | 0.26 m | $1,400 | 0.58 a | 242.3% |
| `api/services/sepa/downloader.py` | 81 | 9 | 34.54 🔴 | 32.77 hs | $655.40 | 0.20 m | $1,400 | 0.47 a | 327.2% |
| `api/services/sepa/ingestion.py` | 79 | 4 | 35.58 🔴 | 31.14 hs | $622.82 | 0.19 m | $1,400 | 0.44 a | 349.6% |
| `api/application/use_cases/sepa_use_cases.py` | 74 | 11 | 35.60 🔴 | 29.16 hs | $583.19 | 0.18 m | $1,400 | 0.42 a | 380.1% |
| `api/security.py` | 73 | 15 | 35.26 🔴 | 29.01 hs | $580.26 | 0.18 m | $1,400 | 0.41 a | 382.5% |
| `api/tests/test_recommendation.py` | 65 | 13 | 37.22 🔴 | 24.56 hs | $491.11 | 0.15 m | $1,400 | 0.35 a | 470.1% |
| `api/tests/test_budgets.py` | 64 | 3 | 38.79 🔴 | 23.17 hs | $463.44 | 0.14 m | $1,400 | 0.33 a | 504.2% |
| `api/infrastructure/dependencies.py` | 60 | 1 | 40.01 🟡 | 21.00 hs | $419.92 | 0.13 m | $1,400 | 0.30 a | 566.8% |
| `api/wallet_adapters/plaid_adapter.py` | 57 | 2 | 40.62 🟡 | 19.60 hs | $391.91 | 0.12 m | $1,400 | 0.28 a | 614.5% |
| `api/routers/ai.py` | 56 | 8 | 40.07 🟡 | 19.56 hs | $391.17 | 0.12 m | $1,400 | 0.28 a | 615.8% |
| `api/domain/entities/product.py` | 57 | 1 | 40.76 🟡 | 19.52 hs | $390.38 | 0.12 m | $1,400 | 0.28 a | 617.3% |
| `api/wallet_adapters/belvo_adapter.py` | 56 | 2 | 40.88 🟡 | 19.11 hs | $382.13 | 0.12 m | $1,400 | 0.27 a | 632.7% |
| `api/infrastructure/repositories/sqlalchemy_user_repository.py` | 52 | 7 | 41.29 🟡 | 17.53 hs | $350.57 | 0.11 m | $1,400 | 0.25 a | 698.7% |
| `api/routers/shopping.py` | 52 | 1 | 42.10 🟡 | 17.11 hs | $342.17 | 0.11 m | $1,400 | 0.24 a | 718.3% |
| `api/wallet_adapters/base_adapter.py` | 49 | 2 | 42.83 🟡 | 15.76 hs | $315.24 | 0.10 m | $1,400 | 0.23 a | 788.2% |
| `api/routers/goals.py` | 47 | 3 | 43.31 🟡 | 14.90 hs | $297.91 | 0.09 m | $1,400 | 0.21 a | 839.9% |
| `api/services/sepa/geo.py` | 44 | 6 | 43.87 🟡 | 13.70 hs | $273.96 | 0.09 m | $1,400 | 0.20 a | 922.1% |
| `api/infrastructure/repositories/sqlalchemy_wallet_repository.py` | 44 | 1 | 44.54 🟡 | 13.40 hs | $268.04 | 0.08 m | $1,400 | 0.19 a | 944.6% |
| `api/routers/transactions.py` | 42 | 1 | 45.22 🟡 | 12.51 hs | $250.14 | 0.08 m | $1,400 | 0.18 a | 1019.4% |
| `api/alembic/env.py` | 40 | 12 | 44.45 🟡 | 12.22 hs | $244.36 | 0.08 m | $1,400 | 0.17 a | 1045.8% |
| `api/services/sepa/cleaner.py` | 40 | 11 | 44.59 🟡 | 12.16 hs | $243.28 | 0.08 m | $1,400 | 0.17 a | 1050.9% |
| `api/services/ocr.py` | 40 | 5 | 45.40 🟡 | 11.84 hs | $236.83 | 0.07 m | $1,400 | 0.17 a | 1082.3% |
| `api/services/budget_service.py` | 39 | 7 | 45.50 🟡 | 11.51 hs | $230.12 | 0.07 m | $1,400 | 0.16 a | 1116.8% |
| `api/database.py` | 37 | 15 | 45.19 🟡 | 11.03 hs | $220.58 | 0.07 m | $1,400 | 0.16 a | 1169.4% |
| `api/infrastructure/repositories/sqlalchemy_transaction_repository.py` | 38 | 1 | 46.68 🟡 | 10.76 hs | $215.20 | 0.07 m | $1,400 | 0.15 a | 1201.1% |
| `api/infrastructure/repositories/sqlalchemy_goal_repository.py` | 36 | 1 | 47.47 🟡 | 9.91 hs | $198.18 | 0.06 m | $1,400 | 0.14 a | 1312.9% |
| `api/ports/repositories/price_repository_port.py` | 34 | 1 | 48.31 🟡 | 9.07 hs | $181.49 | 0.06 m | $1,400 | 0.13 a | 1442.8% |
| `api/services/shopping/extractor_registry.py` | 29 | 8 | 49.69 🟡 | 7.34 hs | $146.77 | 0.05 m | $1,400 | 0.10 a | 1807.7% |
| `api/routers/ocr.py` | 27 | 5 | 51.14 🟡 | 6.44 hs | $128.83 | 0.04 m | $1,400 | 0.09 a | 2073.4% |
| `api/infrastructure/repositories/sqlalchemy_account_repository.py` | 26 | 1 | 52.23 🟡 | 5.92 hs | $118.39 | 0.04 m | $1,400 | 0.08 a | 2265.0% |
| `api/routers/budgets.py` | 26 | 1 | 52.23 🟡 | 5.92 hs | $118.39 | 0.04 m | $1,400 | 0.08 a | 2265.0% |
| `api/infrastructure/repositories/sqlalchemy_budget_repository.py` | 23 | 1 | 54.02 🟡 | 4.82 hs | $96.49 | 0.03 m | $1,400 | 0.07 a | 2802.0% |
| `api/application/use_cases/auth_use_cases.py` | 22 | 1 | 54.67 🟡 | 4.47 hs | $89.43 | 0.03 m | $1,400 | 0.06 a | 3030.9% |
| `api/ports/repositories/goal_repository_port.py` | 21 | 1 | 55.35 🟡 | 4.13 hs | $82.51 | 0.03 m | $1,400 | 0.06 a | 3293.6% |
| `api/ports/repositories/transaction_repository_port.py` | 21 | 1 | 55.35 🟡 | 4.13 hs | $82.51 | 0.03 m | $1,400 | 0.06 a | 3293.6% |
| `api/ports/repositories/wallet_repository_port.py` | 17 | 1 | 58.44 🟡 | 2.81 hs | $56.29 | 0.02 m | $1,400 | 0.04 a | 4874.3% |
| `api/ports/repositories/account_repository_port.py` | 15 | 1 | 60.27 🟡 | 2.21 hs | $44.18 | 0.01 m | $1,400 | 0.03 a | 6238.0% |
| `api/domain/entities/user.py` | 14 | 1 | 61.28 🟡 | 1.92 hs | $38.41 | 0.01 m | $1,400 | 0.03 a | 7190.1% |
| `api/ports/repositories/budget_repository_port.py` | 13 | 1 | 62.37 🟡 | 1.64 hs | $32.85 | 0.01 m | $1,400 | 0.02 a | 8424.2% |
| `api/ports/repositories/user_repository_port.py` | 12 | 1 | 63.54 🟡 | 1.38 hs | $27.51 | 0.01 m | $1,400 | 0.02 a | 10077.2% |
| `api/domain/exceptions.py` | 10 | 1 | 66.20 🟢 | 0.88 hs | $17.60 | 0.01 m | $1,400 | 0.01 a | 15812.7% |
| `api/run_ingesta.py` | 10 | 1 | 66.20 🟢 | 0.88 hs | $17.60 | 0.01 m | $1,400 | 0.01 a | 15812.7% |
| `api/services/shopping/__init__.py` | 10 | 1 | 66.20 🟢 | 0.88 hs | $17.60 | 0.01 m | $1,400 | 0.01 a | 15812.7% |
| `api/services/sepa/config.py` | 9 | 1 | 67.74 🟢 | 0.65 hs | $13.06 | 0.00 m | $1,400 | 0.01 a | 21333.3% |
| `api/ports/extractors/product_extractor_port.py` | 6 | 1 | 73.67 🟢 | 0.08 hs | $1.60 | 0.00 m | $1,400 | 0.00 a | 175362.8% |
| `api/domain/entities/__init__.py` | 3 | 1 | 83.80 🟢 | 0.00 hs | $0.00 | 0.00 m | $1,400 | 0.00 a | 100.0% |
| `api/wallet_adapters/__init__.py` | 5 | 1 | 76.34 🟢 | 0.00 hs | $0.00 | 0.00 m | $1,400 | 0.00 a | 100.0% |

**Subtotal Backend (Python):** `3349.05 horas` | **Costo:** `$66,980.57 USD`

## Frontend (TypeScript / JS) (32 archivos)

| Archivo | LOC | G | 1. MI | 2. Deuda (Hs) | 3. Costo ($) | 4. Meses | 5. Interés Anual | 6. Payback (Años) | 7. ROI (%) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `js/accounts.ts` | 1268 | 462 | 0.00 🔴 | 951.00 hs | $19,020.00 | 5.94 m | $1,400 | 13.59 a | -85.3% |
| `js/shopping.ts` | 911 | 265 | 0.00 🔴 | 683.25 hs | $13,665.00 | 4.27 m | $1,400 | 9.76 a | -79.5% |
| `js/services/scannerService.ts` | 827 | 312 | 0.00 🔴 | 620.25 hs | $12,405.00 | 3.88 m | $1,400 | 8.86 a | -77.4% |
| `js/goals.ts` | 755 | 200 | 0.00 🔴 | 566.25 hs | $11,325.00 | 3.54 m | $1,400 | 8.09 a | -75.3% |
| `js/budgets.ts` | 695 | 173 | 0.00 🔴 | 521.25 hs | $10,425.00 | 3.26 m | $1,400 | 7.45 a | -73.1% |
| `js/supermercados.ts` | 675 | 170 | 0.00 🔴 | 506.25 hs | $10,125.00 | 3.16 m | $1,400 | 7.23 a | -72.3% |
| `js/reports.ts` | 468 | 74 | 0.16 🔴 | 350.27 hs | $7,005.31 | 2.19 m | $1,400 | 5.00 a | -60.0% |
| `js/transactions.ts` | 413 | 170 | 0.00 🔴 | 309.75 hs | $6,195.00 | 1.94 m | $1,400 | 4.42 a | -54.8% |
| `js/services/shoppingService.ts` | 350 | 92 | 1.98 🔴 | 255.56 hs | $5,111.16 | 1.60 m | $1,400 | 3.65 a | -45.2% |
| `js/shoppingList.ts` | 324 | 53 | 8.36 🔴 | 215.92 hs | $4,318.43 | 1.35 m | $1,400 | 3.08 a | -35.2% |
| `js/scanner.ts` | 310 | 75 | 6.04 🔴 | 213.76 hs | $4,275.26 | 1.34 m | $1,400 | 3.05 a | -34.5% |
| `js/import.ts` | 302 | 62 | 8.18 🔴 | 201.81 hs | $4,036.23 | 1.26 m | $1,400 | 2.88 a | -30.6% |
| `js/services/accountService.ts` | 244 | 84 | 8.33 🔴 | 162.67 hs | $3,253.31 | 1.02 m | $1,400 | 2.32 a | -13.9% |
| `js/ui.ts` | 221 | 58 | 13.28 🔴 | 136.40 hs | $2,728.10 | 0.85 m | $1,400 | 1.95 a | 2.6% |
| `js/profile.ts` | 201 | 75 | 12.38 🔴 | 125.87 hs | $2,517.38 | 0.79 m | $1,400 | 1.80 a | 11.2% |
| `js/services/shoppingListService.ts` | 214 | 32 | 17.25 🔴 | 123.59 hs | $2,471.87 | 0.77 m | $1,400 | 1.77 a | 13.3% |
| `js/ai.ts` | 206 | 50 | 15.38 🔴 | 122.81 hs | $2,456.26 | 0.77 m | $1,400 | 1.75 a | 14.0% |
| `js/services/goalService.ts` | 170 | 42 | 19.27 🔴 | 94.75 hs | $1,894.95 | 0.59 m | $1,400 | 1.35 a | 47.8% |
| `js/app.ts` | 157 | 55 | 18.68 🔴 | 88.42 hs | $1,768.43 | 0.55 m | $1,400 | 1.26 a | 58.3% |
| `js/auth.ts` | 158 | 30 | 21.95 🔴 | 83.82 hs | $1,676.37 | 0.52 m | $1,400 | 1.20 a | 67.0% |
| `js/services/authService.ts` | 128 | 35 | 24.36 🔴 | 64.82 hs | $1,296.48 | 0.41 m | $1,400 | 0.93 a | 116.0% |
| `js/components/chatbot.ts` | 102 | 14 | 30.50 🔴 | 45.39 hs | $907.79 | 0.28 m | $1,400 | 0.65 a | 208.4% |
| `js/utils/utils.ts` | 83 | 29 | 31.50 🔴 | 36.11 hs | $722.16 | 0.23 m | $1,400 | 0.52 a | 287.7% |
| `js/services/transactionService.ts` | 81 | 26 | 32.26 🔴 | 34.62 hs | $692.44 | 0.22 m | $1,400 | 0.49 a | 304.4% |
| `js/services/sepaService.ts` | 81 | 24 | 32.53 🔴 | 34.40 hs | $688.09 | 0.22 m | $1,400 | 0.49 a | 306.9% |
| `js/store/store.ts` | 68 | 13 | 36.56 🔴 | 26.14 hs | $522.75 | 0.16 m | $1,400 | 0.37 a | 435.6% |
| `js/services/budgetService.ts` | 54 | 7 | 40.74 🟡 | 18.50 hs | $370.01 | 0.12 m | $1,400 | 0.26 a | 656.7% |
| `js/api/apiClient.ts` | 39 | 14 | 44.56 🟡 | 11.87 hs | $237.46 | 0.07 m | $1,400 | 0.17 a | 1079.1% |
| `js/api/authApi.ts` | 40 | 1 | 45.93 🟡 | 11.63 hs | $232.52 | 0.07 m | $1,400 | 0.17 a | 1104.2% |
| `js/services/cameraService.ts` | 39 | 8 | 45.36 🟡 | 11.56 hs | $231.17 | 0.07 m | $1,400 | 0.17 a | 1111.2% |
| `js/services/chatService.ts` | 30 | 7 | 49.33 🟡 | 7.70 hs | $154.00 | 0.05 m | $1,400 | 0.11 a | 1718.2% |
| `js/types.ts` | 1 | 1 | 99.87 🟢 | 0.00 hs | $0.00 | 0.00 m | $1,400 | 0.00 a | 100.0% |

**Subtotal Frontend (TypeScript / JS):** `6636.39 horas` | **Costo:** `$132,727.93 USD`

## Mobile (Flutter / Dart) (32 archivos)

| Archivo | LOC | G | 1. MI | 2. Deuda (Hs) | 3. Costo ($) | 4. Meses | 5. Interés Anual | 6. Payback (Años) | 7. ROI (%) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `mobile/lib/screens/shopping_screen.dart` | 573 | 82 | 0.00 🔴 | 429.75 hs | $8,595.00 | 2.69 m | $1,400 | 6.14 a | -67.4% |
| `mobile/lib/screens/supermercados_screen.dart` | 345 | 24 | 11.34 🔴 | 219.63 hs | $4,392.54 | 1.37 m | $1,400 | 3.14 a | -36.3% |
| `mobile/lib/screens/transactions_screen.dart` | 248 | 26 | 15.90 🔴 | 146.57 hs | $2,931.50 | 0.92 m | $1,400 | 2.09 a | -4.5% |
| `mobile/lib/screens/profile_screen.dart` | 245 | 23 | 16.48 🔴 | 143.38 hs | $2,867.54 | 0.90 m | $1,400 | 2.05 a | -2.4% |
| `mobile/lib/screens/insights_screen.dart` | 240 | 20 | 17.18 🔴 | 138.76 hs | $2,775.19 | 0.87 m | $1,400 | 1.98 a | 0.9% |
| `mobile/lib/screens/accounts_screen.dart` | 204 | 22 | 19.29 🔴 | 113.65 hs | $2,272.94 | 0.71 m | $1,400 | 1.62 a | 23.2% |
| `mobile/lib/screens/goals_screen.dart` | 184 | 14 | 21.88 🔴 | 97.75 hs | $1,954.99 | 0.61 m | $1,400 | 1.40 a | 43.2% |
| `mobile/lib/screens/budgets_screen.dart` | 170 | 16 | 22.76 🔴 | 88.80 hs | $1,776.05 | 0.56 m | $1,400 | 1.27 a | 57.7% |
| `mobile/lib/screens/scanner_screen.dart` | 166 | 12 | 23.65 🔴 | 85.24 hs | $1,704.84 | 0.53 m | $1,400 | 1.22 a | 64.2% |
| `mobile/lib/screens/login_screen.dart` | 162 | 16 | 23.47 🔴 | 83.48 hs | $1,669.64 | 0.52 m | $1,400 | 1.19 a | 67.7% |
| `mobile/lib/screens/dashboard_screen.dart` | 156 | 13 | 24.42 🔴 | 78.90 hs | $1,578.00 | 0.49 m | $1,400 | 1.13 a | 77.4% |
| `mobile/lib/providers/insights_provider.dart` | 145 | 36 | 22.40 🔴 | 76.27 hs | $1,525.44 | 0.48 m | $1,400 | 1.09 a | 83.6% |
| `mobile/lib/screens/main_layout.dart` | 152 | 9 | 25.34 🔴 | 75.48 hs | $1,509.64 | 0.47 m | $1,400 | 1.08 a | 85.5% |
| `mobile/lib/providers/auth_provider.dart` | 140 | 27 | 24.12 🔴 | 71.23 hs | $1,424.58 | 0.45 m | $1,400 | 1.02 a | 96.5% |
| `mobile/lib/services/api_service.dart` | 134 | 28 | 24.63 🔴 | 67.50 hs | $1,349.97 | 0.42 m | $1,400 | 0.96 a | 107.4% |
| `mobile/lib/screens/reports_screen.dart` | 125 | 11 | 27.93 🔴 | 58.84 hs | $1,176.72 | 0.37 m | $1,400 | 0.84 a | 137.9% |
| `mobile/lib/providers/supermercado_provider.dart` | 116 | 41 | 24.99 🔴 | 58.01 hs | $1,160.27 | 0.36 m | $1,400 | 0.83 a | 141.3% |
| `mobile/lib/models/supermercado_model.dart` | 96 | 25 | 29.91 🔴 | 43.29 hs | $865.78 | 0.27 m | $1,400 | 0.62 a | 223.4% |
| `mobile/lib/providers/shopping_provider.dart` | 61 | 20 | 37.21 🔴 | 23.05 hs | $461.04 | 0.14 m | $1,400 | 0.33 a | 507.3% |
| `mobile/lib/main.dart` | 62 | 3 | 39.26 🔴 | 22.16 hs | $443.20 | 0.14 m | $1,400 | 0.32 a | 531.8% |
| `mobile/lib/providers/accounts_provider.dart` | 48 | 16 | 41.25 🟡 | 16.20 hs | $323.99 | 0.10 m | $1,400 | 0.23 a | 764.2% |
| `mobile/lib/providers/transactions_provider.dart` | 48 | 16 | 41.25 🟡 | 16.20 hs | $323.99 | 0.10 m | $1,400 | 0.23 a | 764.2% |
| `mobile/lib/providers/goals_provider.dart` | 46 | 15 | 42.01 🟡 | 15.18 hs | $303.52 | 0.09 m | $1,400 | 0.22 a | 822.5% |
| `mobile/lib/providers/scanner_provider.dart` | 41 | 11 | 44.23 🟡 | 12.62 hs | $252.33 | 0.08 m | $1,400 | 0.18 a | 1009.7% |
| `mobile/lib/providers/budgets_provider.dart` | 39 | 13 | 44.69 🟡 | 11.82 hs | $236.41 | 0.07 m | $1,400 | 0.17 a | 1084.4% |
| `mobile/lib/providers/dashboard_provider.dart` | 38 | 12 | 45.20 🟡 | 11.32 hs | $226.44 | 0.07 m | $1,400 | 0.16 a | 1136.5% |
| `mobile/lib/models/goal.dart` | 27 | 18 | 49.39 🟡 | 6.91 hs | $138.27 | 0.04 m | $1,400 | 0.10 a | 1925.0% |
| `mobile/lib/services/supermercado_service.dart` | 23 | 6 | 53.35 🟡 | 4.98 hs | $99.58 | 0.03 m | $1,400 | 0.07 a | 2711.8% |
| `mobile/lib/models/account.dart` | 20 | 8 | 55.13 🟡 | 3.97 hs | $79.49 | 0.02 m | $1,400 | 0.06 a | 3422.3% |
| `mobile/lib/models/budget.dart` | 20 | 6 | 55.40 🟡 | 3.92 hs | $78.42 | 0.02 m | $1,400 | 0.06 a | 3470.7% |
| `mobile/lib/models/transaction.dart` | 20 | 3 | 55.80 🟡 | 3.84 hs | $76.80 | 0.02 m | $1,400 | 0.05 a | 3545.7% |
| `mobile/lib/services/api_config.dart` | 3 | 1 | 83.80 🟢 | 0.00 hs | $0.00 | 0.00 m | $1,400 | 0.00 a | 100.0% |

**Subtotal Mobile (Flutter / Dart):** `2228.70 horas` | **Costo:** `$44,574.11 USD`

