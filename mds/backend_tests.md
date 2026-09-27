# Pruebas Unitarias del Backend (Tests Unitarios)

En este proyecto de Finanzas, hemos implementado pruebas unitarias para asegurar que la lógica de negocio funcione correctamente. Los tests están ubicados en el directorio `api/tests/` y utilizamos el framework `pytest`.

## ¿Qué son las pruebas unitarias y por qué usamos Mocks?
Las pruebas unitarias nos permiten evaluar el comportamiento de métodos o funciones individuales en aislamiento. 
Para los servicios (ej. `AccountService`, `BudgetService`, `GoalService`), sus responsabilidades principales son validar reglas de negocio y delegar la persistencia de datos a los repositorios (patrón Repository).

Dado que probar con una base de datos real es lento y puede generar problemas de concurrencia o estado, utilizamos **Mocks** (objetos simulados).
Un *Mock* es un objeto falso que imita el comportamiento del repositorio real. Por ejemplo, en lugar de que el repositorio vaya a la base de datos a buscar una cuenta, programamos al *Mock* para que devuelva un objeto `Account` predefinido instantáneamente.
Esto se logra con `unittest.mock.MagicMock` en Python.

## Servicios Probados

### 1. AccountService (`test_accounts.py`)
- **test_get_user_accounts**: Verifica que se llame al repositorio para obtener las cuentas del usuario y devuelva la lista.
- **test_create_account**: Valida que al pasar un `AccountCreate` válido, se cree y retorne la nueva cuenta.
- **test_update_account_success / not_found**: Verifica la actualización exitosa o que lance una excepción `HTTPException 404` si la cuenta no existe.
- **test_delete_account_success / not_found**: Verifica que, al borrar, se eliminen también las transacciones y conexiones asociadas (llamando a sus respectivos repositorios mockeados).

### 2. BudgetService (`test_budgets.py`)
- **test_get_user_budgets**: Chequea que el servicio obtenga la lista de presupuestos.
- **test_create_budget**: Confirma la creación del presupuesto mapeando el schema `BudgetCreate` al modelo `Budget`.
- **test_update_budget**: Valida las actualizaciones de los límites y detalles del presupuesto.
- **test_delete_budget**: Asegura el borrado si se encuentra el ID, o lanza 404.

### 3. GoalService (`test_goals.py`)
- **test_get_user_goals / create / update / delete**: Verifica el CRUD completo. Nota que este servicio realiza un formateo de la meta junto con sus contribuciones.
- **test_add_contribution_success**: Chequea que al agregar una contribución financiera, no solo se guarde la contribución, sino que el valor `current` del modelo `Goal` se incremente adecuadamente y se actualice mediante su repositorio.

## Cómo ejecutar las pruebas
Para ejecutar las pruebas en tu entorno de desarrollo, asegúrate de estar dentro del entorno virtual y en el directorio `api`, luego ejecuta:
```bash
pytest tests/
```
Esto correrá todos los archivos `test_*.py` y te entregará un reporte con las pruebas que pasaron o fallaron.
