# Principios de Diseño Aplicados en Flujo

Este documento detalla las decisiones de diseño y los principios aplicados para transformar la aplicación "Flujo" en una experiencia premium.

## 1. Estética y Usabilidad (Aesthetic-Usability Effect)
Los usuarios tienden a percibir el diseño estéticamente agradable como un diseño que es más fácil de usar. Para lograr esto, hemos implementado:
- **Glassmorphism**: El uso de `backdrop-filter: blur()` en la barra lateral y paneles crea una sensación de profundidad y jerarquía, separando claramente el contenido del fondo dinámico.
- **Gradientes Suaves**: En lugar de colores planos, el fondo utiliza gradientes radiales sutiles que aportan dinamismo sin distraer.

## 2. Jerarquía Visual
La jerarquía guía el ojo del usuario hacia la información más importante:
- **Tipografía**: Hemos cambiado las fuentes a **Outfit** para los encabezados (una fuente geométrica moderna) y **JetBrains Mono** para los datos numéricos, asegurando legibilidad y un toque tecnológico.
- **Pesos Visuales**: Las tarjetas de estadísticas utilizan valores grandes y negritas para resaltar el saldo y los gastos de inmediato.

## 3. Micro-interacciones y Feedback
Una interfaz que responde se siente "viva":
- **Transiciones**: Hemos añadido transiciones suaves de `0.3s` con curvas de `cubic-bezier` a todos los botones y tarjetas.
- **Efecto Shimmer**: El modal de IA incluye un efecto de brillo animado que indica procesamiento y modernidad.

## 4. Optimización SEO y Accesibilidad
Un buen diseño no es solo visual, sino también funcional y accesible:
- **Etiquetas Meta**: Se han añadido descripciones y palabras clave para mejorar la visibilidad.
- **H1 Semántico**: Se incluyó un encabezado principal oculto visualmente pero accesible para lectores de pantalla y motores de búsqueda.
- **Tipografía**: El uso de `Outfit` mejora la legibilidad en pantallas de alta resolución.

## 5. Integración de IA
Para la funcionalidad de "IA Insights", hemos pasado de un simple mensaje de texto a un modal dedicado que utiliza una imagen de alta fidelidad (mockup), reforzando la propuesta de valor premium de la aplicación.
