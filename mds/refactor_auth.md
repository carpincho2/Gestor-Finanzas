# Refactor de Autenticación - Arquitectura Limpia (Clean Architecture)

Se ha refactorizado el módulo de autenticación tanto en el Frontend como en el Backend para adherirse a los principios de Clean Architecture. Esto mejora la separación de preocupaciones, facilita las pruebas (testing) y el mantenimiento del código a futuro.

## 1. Frontend

### Problema anterior
El archivo `js/auth.js` contenía tanto la lógica de la interfaz de usuario (manipulación del DOM, manejo de eventos de botones) como la lógica de negocio (llamadas a la API `IS_SERVER`, almacenamiento en `localStorage`, creación del objeto usuario, etc.).

### Solución
- **`js/services/authService.js`**: Se creó un nuevo servicio encargado exclusivamente de manejar la lógica de estado y obtención de datos. Este archivo contiene las funciones `checkSession`, `loginUser`, `registerUser`, `googleLoginUser`, y `saveSession`. 
- **`js/auth.js`**: Se modificó para actuar únicamente como un controlador de la vista. Se eliminó la lógica de manipulación de estado y validación de usuarios; ahora delega estas tareas a `authService.js` y, de acuerdo al resultado, actualiza la interfaz (mostrando un error o redirigiendo al dashboard).

## 2. Backend

### Problema anterior
El archivo `api/routers/auth.py` mezclaba la definición de rutas (endpoints), la extracción de parámetros de la petición y la lógica de negocio (validaciones de contraseña fuerte, hasheo con `bcrypt`, verificación de intentos de login, manipulación de registros en la base de datos).

### Solución
- **`api/services/auth_service.py`**: Se extrajo toda la lógica de negocio hacia un servicio llamado `AuthService`. Este servicio recibe la sesión de la base de datos (`Session`) mediante Inyección de Dependencias. Contiene métodos como `login()`, `register()`, `google_login()`, `update_profile()`, etc., los cuales interactúan con la base de datos y retornan entidades y tokens limpios o arrojan excepciones (HTTPException).
- **`api/routers/auth.py`**: Ahora los endpoints son mucho más limpios. Su única responsabilidad es recibir el _Request_, inyectar `AuthService` mediante `Depends(get_auth_service)`, llamar al método correspondiente del servicio, modificar la sesión (cookies) si corresponde, y retornar el _Response_ (JSON). Todo el manejo de errores esperado se delega en excepciones capturadas o propagadas.

## Beneficios
- **Testing**: Ahora se puede instanciar `AuthService` en pruebas unitarias y pasarle un "mock" de la base de datos sin necesidad de levantar el servidor FastAPI. Igualmente en el frontend con `authService.js`.
- **Mantenibilidad**: Modificar la regla de qué es una "contraseña fuerte" solo requiere cambiar el archivo del servicio sin tocar el router.
- **Reusabilidad**: La lógica de login y obtención de usuario puede ser reutilizada por otros componentes si fuera necesario.
