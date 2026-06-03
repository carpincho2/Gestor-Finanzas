# Refactorización SOLID en Flujo

Hemos transformado un script monolítico en una arquitectura modular y escalable. A continuación, se detalla cómo se aplica cada principio SOLID:

## 1. Single Responsibility Principle (SRP)
Cada clase y archivo tiene ahora una única razón para cambiar:
- **`Storage.js`**: Solo se encarga de la persistencia en `localStorage`.
- **`TransactionService.js`**: Maneja exclusivamente la lógica de negocio y el estado de las transacciones.
- **`UIManager.js`**: Su única responsabilidad es interactuar con el DOM y renderizar datos.
- **`ChartService.js`**: Gestiona la configuración y renderizado de gráficos.

## 2. Open/Closed Principle (OCP)
El sistema está diseñado para ser extendido sin modificar el código existente. Por ejemplo, si quisiéramos añadir un nuevo tipo de almacenamiento (ej. una API externa), podríamos crear un nuevo servicio que siga la misma interfaz que `Storage.js` sin tocar la lógica de las transacciones.

## 3. Liskov Substitution Principle (LSP)
Aunque es un proyecto pequeño sin mucha herencia, las clases están diseñadas para que cualquier implementación de un "Servicio" pueda ser intercambiada si cumplen con los métodos esperados por el controlador principal (`App`).

## 4. Interface Segregation Principle (ISP)
Al usar módulos ES6, los componentes solo importan lo que realmente necesitan. `UIManager` no necesita saber cómo se calculan las estadísticas, solo recibe el objeto de datos final para mostrarlo.

## 5. Dependency Inversion Principle (DIP)
El controlador principal `App` no depende de los detalles de implementación de `Chart.js`. En su lugar, utiliza el `ChartService` como una abstracción. Si mañana decidimos usar *D3.js* o *Highcharts*, solo tendríamos que actualizar `ChartService.js`.

## Beneficios Obtenidos
- **Mantenibilidad**: Es mucho más fácil localizar y corregir errores.
- **Testabilidad**: Ahora se podrían escribir tests unitarios para `TransactionService.js` sin necesidad de un navegador o del DOM.
- **Legibilidad**: El punto de entrada (`script.js`) es ahora limpio y describe la orquestación de la aplicación de forma clara.
