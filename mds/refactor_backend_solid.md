# Refactorización del Backend: SOLID y PHAME en `budgets`

## Resumen de Cambios
Como parte de la implementación del plan de mantenibilidad, hemos refactorizado el módulo de presupuestos (`budgets.py`) en el backend (FastAPI) para alinearlo con los estándares de Google y los principios **SOLID** y **PHAME**.

## Detalles de la Refactorización

### 1. Inversión de Dependencias y Segregación de Interfaces (DIP e ISP)
**Antes**: El enrutador dependía directamente de `sqlalchemy.orm.Session`.
**Ahora**: 
- Creamos una interfaz `IBudgetRepository` (`api/ports/repositories/budget_repository_port.py`) usando `typing.Protocol`.
- Creamos una implementación concreta `SQLAlchemyBudgetRepository` (`api/infrastructure/repositories/sqlalchemy_budget_repository.py`).
- Esto significa que la lógica de negocio ya no sabe qué base de datos estamos usando. Podríamos cambiar a MongoDB en el futuro escribiendo un nuevo repositorio sin tocar el resto del código.

### 2. Responsabilidad Única (SRP) y Jerarquía (PHAME)
**Antes**: `api/routers/budgets.py` hacía tres cosas: recibía la petición web, aplicaba reglas de negocio (crear y preparar los modelos) y operaba la base de datos (`db.commit()`, `db.add()`).
**Ahora**:
- Dividimos la lógica en capas estrictas:
  - **Capa de Infraestructura (Router)**: `api/routers/budgets.py` solo se encarga de recibir peticiones HTTP y retornar respuestas JSON.
  - **Capa de Negocio (Service)**: `api/services/budget_service.py` (`BudgetService`) contiene toda la lógica de validación y transformación de modelos.
  - **Capa de Acceso a Datos (Repository)**: Encargada puramente de la persistencia (SQLAlchemy).

### 3. Configuración de Análisis Estático
- Se creó el archivo `pyproject.toml` en la raíz del proyecto para definir las reglas de linting y métricas utilizando `Ruff`, `MyPy` y `Radon`. 
- Esto garantizará que todo el código futuro de Python se someta a mediciones de complejidad ciclomática automáticas.

## Próximos pasos
El resto de los enrutadores (ej. `goals.py`, `transactions.py`) deberán seguir esta misma estructura en el futuro cercano para asegurar un Índice de Mantenibilidad (Maintainability Index) superior a 65 en toda la aplicación.
