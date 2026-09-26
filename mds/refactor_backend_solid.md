# Refactorización del Backend: SOLID y PHAME en `budgets`

## Resumen de Cambios
Como parte de la implementación del plan de mantenibilidad, hemos refactorizado los módulos base del backend (`budgets.py`, `goals.py`, `transactions.py` y `accounts.py`) para alinearlos con los estándares de Google y los principios **SOLID** y **PHAME**.

## Detalles de la Refactorización

### 1. Inversión de Dependencias y Segregación de Interfaces (DIP e ISP)
**Antes**: Todos los enrutadores dependían directamente de `sqlalchemy.orm.Session`.
**Ahora**: 
- Creamos interfaces (`ports/repositories/`) para cada modelo de negocio: `IBudgetRepository`, `IGoalRepository`, `ITransactionRepository`, `IAccountRepository` y `IWalletRepository`.
- Creamos sus implementaciones concretas en `infrastructure/repositories/`.
- Esto desacopla el negocio de la base de datos SQL.

### 2. Responsabilidad Única (SRP) y Jerarquía (PHAME)
**Antes**: Los enrutadores hacían 3 cosas: recibir HTTP, aplicar reglas de negocio, y operar la DB. Por ejemplo, `transactions.py` modificaba directamente los saldos de `Account`.
**Ahora**:
- Dividimos la lógica en capas estrictas inyectadas a través de `infrastructure/dependencies.py`:
  - **Capa de Infraestructura (Router)**: Enrutadores limpios y delegados.
  - **Capa de Negocio (Service)**: Por ejemplo, `TransactionService` recibe inyectados tanto `ITransactionRepository` como `IAccountRepository` para actualizar los saldos limpiamente sin tocar SQL. 
  - **Capa de Acceso a Datos (Repository)**: Encargada puramente de la persistencia (SQLAlchemy).

### 3. Configuración de Análisis Estático
- Se creó el archivo `pyproject.toml` en la raíz del proyecto para definir las reglas de linting y métricas utilizando `Ruff`, `MyPy` y `Radon`. 

## Próximos pasos
Refactorizar la lógica masiva de sincronización (`sync_account_transactions` en `accounts.py`) hacia un `SyncService` especializado.
