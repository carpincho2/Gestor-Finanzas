# Arquitectura Hexagonal - Flujo

Hemos implementado el patrón de **Arquitectura Hexagonal** (Puertos y Adaptadores) para asegurar que el núcleo de la aplicación sea independiente de las herramientas externas.

## 1. Capa de Dominio (`js/domain/`)
Es el corazón del sistema. Contiene las entidades (`Transaction.js`) que definen qué es una transacción y cómo se valida. No sabe nada de la interfaz web ni de cómo se guardan los datos.

## 2. Capa de Aplicación (`js/application/`)
Contiene los **Casos de Uso** (`usecases/`). Por ejemplo, `AddTransactionUseCase` orquestra el proceso de crear una transacción, validarla con el dominio y enviarla al repositorio para su guardado.

## 3. Capa de Infraestructura (`js/infrastructure/`)
Contiene los **Adaptadores de Salida**. En nuestro caso, `LocalStorageTransactionRepository.js` es una implementación específica que guarda los datos en el navegador. Si en el futuro queremos usar una base de datos real, solo tendríamos que crear un nuevo adaptador aquí.

## 4. Capa de Interfaz de Usuario (`js/ui/`)
Contiene los **Adaptadores de Entrada**. `WebUIAdapter.js` escucha los eventos del navegador (clicks en botones) y los traduce en llamadas a los casos de uso de la aplicación.

## Flujo de Dependencias
Las dependencias siempre apuntan hacia el centro (el dominio). La infraestructura depende del dominio, pero el dominio no depende de nadie. Esto se logra mediante la **Inyección de Dependencias** realizada en el bootstrapper principal (`js/main.js`).
