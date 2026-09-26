# Refactorización de Objetivos (Frontend) - Principios SOLID y Arquitectura PHAME

## Resumen
Se extrajo la lógica de negocio, manipulación de estado (`state.goals`) y comunicación con el backend (llamadas a la API) del archivo `js/goals.js`, trasladándolas a un nuevo servicio dedicado: `js/services/goalService.js`.

## Cambios Realizados

1. **Creación de `goalService.js`**:
   - Centraliza las funciones: `initGoals`, `createGoal`, `updateGoal`, `deleteGoal`, `addContribution` y `removeContribution`.
   - Se encarga de evaluar `IS_SERVER` para decidir si se envía una solicitud al backend o si se modifica directamente el estado local (para persistirlo en localStorage).

2. **Modificación de `goals.js`**:
   - Ahora actúa netamente como capa UI/DOM.
   - Ya no importa `apiFetch`, ni modifica `state.goals` de manera directa. En su lugar, importa los métodos del `goalService` para ejecutar las acciones necesarias (guardar un objetivo, eliminar, aportar, etc.).
   - Se han actualizado los manejadores de eventos (ej. `saveGoal`, `saveContrib`, `deleteContrib`, `doDeleteGoal`) para delegar el procesamiento de los datos recolectados en el DOM al servicio.

## Beneficios
- **Single Responsibility Principle (SRP)**: `goals.js` ahora solo se preocupa por renderizar y reaccionar a la interfaz de usuario, mientras que `goalService.js` maneja cómo y dónde se almacenan los datos.
- **Mantenibilidad**: Es mucho más sencillo probar y evolucionar la lógica de negocio independientemente del ciclo de vida del DOM.
