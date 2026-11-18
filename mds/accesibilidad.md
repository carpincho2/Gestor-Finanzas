# Accesibilidad (WCAG 2.2 AA) — Flujo

Objetivo: que la interfaz sea legible y operable por personas con baja visión, daltonismo, uso de teclado o lectores de pantalla.

## Qué se hizo y por qué

| Problema detectado | Solución | Criterio WCAG |
| :--- | :--- | :--- |
| `.btn-secondary` no existía en el CSS → botones blancos con texto verde ilegible | Definido en `css/accessibility.css` con fondo oscuro, borde verde y texto claro | 1.4.3 Contraste mínimo |
| Texto de 11–12 px | Mínimo 13 px (14–15 px en textos principales) | 1.4.4 Cambio de tamaño |
| Ítems comprados con `opacity: .6` (bajaba el contraste) | Se distinguen con tachado + texto "(comprado)" para lectores, sin bajar la opacidad | 1.4.1 Uso del color |
| Botón de eliminar solo con ícono | `aria-label="Eliminar <producto> de la lista"` y SVG con `aria-hidden` | 4.1.2 Nombre, función, valor |
| Inputs solo con `placeholder` | `<label for>` visible en Producto, Cantidad y Categoría | 3.3.2 Etiquetas |
| Sin indicador de foco | `:focus-visible` con contorno cian de 3 px | 2.4.7 Foco visible |
| Objetivos táctiles pequeños (18 px) | Checkbox 24 px, botones ≥ 38–44 px | 2.5.8 Tamaño del objetivo |
| Animaciones siempre activas | `prefers-reduced-motion` desactiva transiciones | 2.3.3 Animación |
| Modo de alto contraste de Windows | Regla `forced-colors: active` | 1.4.11 Contraste no textual |
| Listas sin semántica | `role="list"` / `role="listitem"`, `<section>`, `<h3>`, `role="status"` en el contador | 1.3.1 Información y relaciones |

## Contraste (sobre fondo `#06080c`)

| Color | Uso | Ratio aprox. |
| :--- | :--- | :--- |
| `#f8fafc` | Texto principal | ~19:1 |
| `#cbd5e1` | Texto secundario (antes `#94a3b8`) | ~13:1 |
| `#00ffaa` | Acento / precios | ~15:1 |
| `#00e5ff` | Enlaces y foco | ~14:1 |

## Archivos
- `css/accessibility.css` — reglas globales (foco, `.btn-secondary`, `.sr-only`, movimiento reducido, alto contraste).
- `css/views/shopping_list.css` — Lista de Compras (estilos extraídos de `style=""` inline).
- `css/views/sepa.css` — filas del buscador SEPA.
- `html/views/lista_compras.html` y `js/shoppingList.ts` — marcado semántico y atributos ARIA.

## Pendiente
Aplicar el mismo tratamiento al resto de vistas (cabecera de tarjetas SEPA, presupuestos, cuentas) y validar con NVDA y con la extensión axe DevTools.
