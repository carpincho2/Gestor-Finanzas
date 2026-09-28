# Documentación del Chatbot Flotante

Se ha implementado un chatbot flotante para interactuar con el asistente de IA en la aplicación. 

## Componentes agregados:
- **`css/chatbot.css`**: Define los estilos del widget flotante, la burbuja de chat y la ventana de conversación.
- **`js/services/chatService.ts`**: Servicio que maneja la comunicación con el endpoint del backend (`/api/ai/chat`), enviando el mensaje y el historial de la conversación.
- **`js/components/chatbot.ts`**: Controlador del UI que maneja la apertura y cierre del widget, la adición de mensajes de usuario y respuestas del asistente a la ventana, así como el indicador de "escribiendo".

## Modificaciones en archivos existentes:
- **`main.html`** e **`index.html`**: Se inyectó el HTML del widget flotante (burbuja de chat y ventana) justo antes del cierre del body, se agregó la referencia a `css/chatbot.css` en el `<head>` y se importó `js/components/chatbot.ts` al final de los archivos.

Este chatbot proporciona una interfaz global para que el usuario consulte al asistente en cualquier momento dentro de la aplicación.
