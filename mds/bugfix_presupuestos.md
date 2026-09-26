# Corrección de Bug: Botón "Nuevo Presupuesto"

## Descripción del problema
El usuario reportó que al intentar crear un nuevo presupuesto en la sección correspondiente, el botón no reaccionaba.

## Causa raíz encontrada
Al analizar la función `openBudgetModal()` en `js/budgets.js`, se identificaron dos problemas potenciales que impedían que el modal se abriera:
1. **Problema con el argumento `id`:** Cuando la función se llamaba desde el evento `onclick` del HTML sin parámetros, o mediante escuchadores de eventos que enviaban objetos tipo `Event` (como `PointerEvent`), el código evaluaba ese objeto como `id` válido, lo cual provocaba que el método buscara un presupuesto inexistente en el array y terminara la función prematuramente (debido al `return` por no encontrar el presupuesto).
2. **Posible ReferenceError en Strict Mode:** La función `updateCustomSelectDisplay` se llamaba de forma directa sin el prefijo `window.`. Debido a que `budgets.js` es un módulo (ES Module importando `store`), dependiendo del entorno y momento de ejecución, el navegador podría lanzar un error de referencia (ReferenceError), rompiendo la ejecución del script justo antes de añadir la clase `open` al overlay del modal.

## Solución implementada
- Se añadió una verificación `typeof id === 'object'` al inicio de la función `openBudgetModal()` para descartar eventos del DOM accidentalmente enviados. Si se recibe un objeto, se asume que no es un `id` real y se convierte a `null`, abriendo el modal en modo "Nuevo Presupuesto".
- Se corrigieron las llamadas a la función global utilizando explícitamente `window.updateCustomSelectDisplay(...)` de manera segura, evitando errores de scope.
- Se envolvieron las manipulaciones de los elementos del DOM (como `bmEmojiGrid`, `bmColorGrid` y `budgetModalOverlay`) en verificaciones (por ejemplo, `if (emojiGrid)`) para prevenir crash de la UI por si algún elemento tarda en renderizar en el HTML principal.

Estas modificaciones hacen el modal robusto contra el fallo silencioso y permite que el botón reaccione siempre.
