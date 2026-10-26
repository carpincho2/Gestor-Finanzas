# Organización del Proyecto: Flujo — Gestor de Finanzas

¡Hola! Como estudiante, entender la estructura de carpetas de una aplicación web es fundamental. Aquí tienes una explicación detallada de cómo hemos reorganizado el proyecto para que sea limpio, profesional y fácil de entender.

---

## 1. Estructura de Directorios

El proyecto sigue una estructura modular y limpia para desarrollo web frontend y backend:

```
Gestor de Finanzas/
├── index.html                   # Entrada principal: pantalla de Login y Registro
├── main.html                    # Aplicación principal: Dashboard y vistas del gestor
├── render.yaml                  # Manifiesto de infraestructura para despliegue automático en Render
├── .htaccess                    # Configuración del servidor web Apache (si se despliega allí)
├── iniciar_backend.bat          # Script por lotes de Windows para iniciar el servidor de desarrollo
├── css/
│   └── styles.css               # Todos los estilos CSS visuales de la aplicación
├── js/
│   ├── auth.js                  # Lógica JavaScript exclusiva para index.html (Login/Registro)
│   └── app.js                   # Lógica del cliente para main.html (Dashboard, OCR, etc.)
├── data/                        # Archivos de datos estáticos y configuraciones de la app [NUEVO]
│   └── OCR_PATTERNS.json        # Diccionario de patrones globales y universales para OCR
├── database/
│   └── setup.sql                # Script SQL histórico de respaldo
├── tests/                       # Carpeta dedicada a pruebas y ejemplos didácticos [NUEVO]
│   ├── OCR_IMPLEMENTATION_EXAMPLES.js # Ejemplos de implementación del OCR
│   ├── OCR_TEST_CASES.js        # Suite de pruebas automatizadas del OCR
│   └── tickets/                 # Tickets de prueba manual en formato de imagen
│       ├── ticket 2.jpg
│       ├── ticket 3.jpg
│       └── ticket-compra-junun-cerveza-limon-redes-socialesjpg.jpg
├── api/                         # Código backend en Python (FastAPI)
│   ├── main.py                  # Endpoints de la API, gestión de base de datos y sesiones
│   ├── database.db              # Base de datos SQLite local autogenerada
│   ├── requirements.txt         # Dependencias del backend de Python
│   └── fluxo_venv/              # Entorno virtual de Python para aislamiento de librerías
└── mds/                         # Carpeta dedicada EXCLUSIVAMENTE a documentación Markdown (.md)
    ├── organizacion.md          # Esta guía explicativa
    ├── INICIO_AQUI.md           # Guía general e índice de navegación
    ├── autenticacion_y_responsive.md # Documentación de autenticación y diseño adaptable
    ├── OCR_IMPROVEMENT_PLAN.md  # Plan técnico completo y algoritmos del OCR
    ├── IMPLEMENTATION_GUIDE.md  # Guía paso a paso para implementar el OCR
    ├── investigacion_mp.md      # Investigación para la integración de la API de Mercado Pago (LATAM)
    └── investigacion_multinacional_pagos.md # Agregación financiera internacional y Open Banking (Mundial)
```

---

## 2. ¿Por qué organizamos el proyecto así?

### A. Separación de Autenticación y Dashboard (`index.html` y `main.html`)
Dividir la interfaz en dos páginas HTML limpias e independientes aporta grandes beneficios:
- **`index.html` (Autenticación)**: Contiene únicamente el formulario de Login y Registro. Evita cargar componentes pesados del Dashboard antes de que el usuario haya iniciado sesión. Carga `js/auth.js` que maneja las peticiones de ingreso y redirige a `main.html` al tener éxito.
- **`main.html` (Dashboard principal)**: Es la interfaz interna donde se realiza la gestión. Protege su contenido: si `js/app.js` detecta que no hay una sesión activa, redirige automáticamente al usuario de vuelta a `index.html`.

### B. Separación de Responsabilidades y Limpieza de Recursos (Concepto "Separation of Concerns")
En el desarrollo de software profesional, cada directorio debe tener un propósito semántico claro:
- **Datos y Configuración (`data/`)**: Mantenemos los archivos puramente de datos separados del código. `data/OCR_PATTERNS.json` es el diccionario JSON consumido por el frontend, ubicado fuera de la documentación.
- **Pruebas y Recursos didácticos (`tests/`)**: Los ejemplos de JavaScript (`OCR_IMPLEMENTATION_EXAMPLES.js`), la suite de testeo interactiva (`OCR_TEST_CASES.js`) y las imágenes de prueba (`tests/tickets/`) están agrupados en un espacio de testing para no contaminar el código fuente de producción en `/js` ni la documentación en `/mds`.
- **Documentación limpia (`mds/`)**: Almacena exclusivamente archivos `.md` de lectura. Esto facilita la navegación del estudiante y mantiene la documentación como un recurso estático puro sin lógica ni scripts ejecutables.
- **HTML, CSS, JS de Producción (`/`, `css/`, `js/`)**: Contiene únicamente los archivos necesarios para la interfaz visual y la lógica interactiva del usuario final.
- **Backend y persistencia (`api/`)**: Centraliza la lógica de API de FastAPI y almacena la base de datos de pruebas local.

### C. Nombres Limpios e Inequívocos
Hemos evitado nombres con espacios ("finanzas  6.js") o carpetas innecesarias (como el entorno virtual duplicado `venv` que fue eliminado, dejando únicamente `fluxo_venv` que se usa activamente). Esto previene fallos al desplegar en servidores Linux.

---

## 3. ¿Cómo se comunican los archivos?

### Enlace Frontend:
- `index.html` vincula en la cabecera `<link rel="stylesheet" href="css/styles.css">` y al final `js/auth.js`.
- `main.html` vincula la misma hoja de estilos, carga las librerías de `Chart.js` y `Tesseract.js` desde CDNs y finalmente corre `js/app.js`.

### Enlace Backend/Frontend:
En los archivos de scripts, la constante `API_BASE` apunta a `http://localhost:8000/api` (bajo desarrollo local) para realizar peticiones HTTP seguras (usando `fetch` con `credentials: 'include'`).

El backend de FastAPI gestiona la sesión mediante `SessionMiddleware` y responde con objetos JSON estandarizados en caso de error:
```json
{
  "error": "Email o contraseña incorrectos"
}
```
La función `apiFetch` en el cliente lee las cabeceras de respuesta y, en caso de fallo, procesa la respuesta de error o texto plano para alertar al usuario a través de notificaciones toast.

---

## 4. Arquitectura de los Puntos de Entrada (`main`) — SOLID & PHAME

El proyecto se enfoca 100% en su arquitectura **Web Responsive + API Backend** (habiendo dejado fuera del alcance activo el directorio `mobile/`), contando con dos puntos de entrada principales (*Composition Roots*), cada uno diseñado bajo el **Principio de Responsabilidad Única (SRP)**:

1. **Backend (`api/main.py` y `api/infrastructure/migrations.py`)**:
   - `api/main.py` actúa exclusivamente como *Composition Root*: configura el ciclo de vida (`lifespan`), middlewares de seguridad (`SessionMiddleware`, `CORSMiddleware`, cabeceras HTTP), registra los routers modulares, provee el endpoint `/health` y ejecuta la tarea asíncrona `render_keep_alive()`.
   - Las migraciones automáticas de columnas (`migrate_schema_columns`) y el cifrado de tokens (`migrate_plaintext_tokens`) se encuentran desacoplados en `api/infrastructure/migrations.py`.
   - Por seguridad, solo se exponen públicamente las carpetas estáticas necesarias (`/js`, `/css`, `/html`, `/data`), manteniendo ocultos los directorios internos `/mds` y `/tests`.

2. **Frontend Web (`index.html`, `main.html`, `js/*.ts` y `css/chatbot.css`)**:
   - Todas las vistas principales (`dashboardView`, `txView`, `perfilView`, etc.) se inyectan dinámicamente desde `html/views/*.html`.
   - **Compatibilidad Universal de Módulos ES (`js/*.ts`)**: Los módulos en `js/` utilizan sintaxis ES6+ estándar con tipado mediante JSDoc, permitiendo su ejecución directa en navegadores sin transpilación intermedia (tanto desde FastAPI y Apache como mediante Vite). Todos los módulos exportan explícitamente sus funciones (`export function ...`) y califican con `window.*` las llamadas cruzadas entre módulos para evitar `ReferenceError` en el modo estricto (`"use strict"`) de ES Modules nativos. Tanto `api/main.py` (`mimetypes.add_type("application/javascript", ".ts")`) como `.htaccess` (`AddType application/javascript .ts`) registran el MIME type correcto para evitar bloqueos por `X-Content-Type-Options: nosniff`.
   - **Carga de Datos Desacoplada (`js/services/dataLoader.ts`)**: Para evitar dependencias circulares entre el orquestador principal (`app.ts`) y los servicios de dominio (`budgetService.ts`, `transactionService.ts`, `profile.ts`), la lógica de carga y sincronización de datos de usuario (`loadUserData`) se aísla en `js/services/dataLoader.ts`, permitiendo recargas reactivas limpias tras registrar o editar movimientos.
   - **Fallback Inteligente de Autenticación (`js/services/authService.ts` y `js/profile.ts`)**: Si el cliente se abre en un servidor web estático mientras el backend FastAPI (`:8000`) está apagado, el servicio detecta el error de red (`Failed to fetch`) y conmuta automáticamente al modo local (`localStorage`), garantizando que el inicio de sesión y el registro funcionen siempre sin interrupciones.
   - **No-bloqueo de Eventos de Puntero (`css/chatbot.css`)**: El contenedor flotante `.chatbot-widget` emplea `pointer-events: none` (habilitando `pointer-events: auto` solo en `.chatbot-bubble` y `.chatbot-window.is-open`) para no interceptar clics sobre botones subyacentes como el de "Iniciar sesión".
   - Los estilos se encuentran desacoplados en hojas modulares dentro de `css/` (`components.css`, `layout.css`, `views/*.css`) sin estilos en línea.
   - Los modales de creación y edición de transacciones comparten las mismas categorías normalizadas y permiten vincular cada movimiento a una **Cuenta** específica (`mAccount` y `eAccount`).

