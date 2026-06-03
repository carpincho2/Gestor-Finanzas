# Organización del Proyecto: Flujo — Gestor de Finanzas

¡Hola! Como estudiante, entender la estructura de carpetas de una aplicación web es fundamental. Aquí tienes una explicación detallada de cómo hemos reorganizado el proyecto para que sea limpio, profesional y fácil de entender.

---

## 1. Estructura de Directorios

El proyecto sigue una estructura modular y limpia para desarrollo web frontend y backend:

```
Gestor de Finanzas/
├── index.html                   # Entrada principal: pantalla de Login y Registro
├── main.html                    # Aplicación principal: Dashboard y vistas del gestor
├── .htaccess                    # Configuración del servidor web Apache (si se despliega allí)
├── iniciar_backend.bat          # Script por lotes de Windows para iniciar el servidor de desarrollo
├── css/
│   └── styles.css               # Todos los estilos CSS visuales de la aplicación
├── js/
│   ├── auth.js                  # Lógica JavaScript exclusiva para index.html (Login/Registro)
│   └── app.js                   # Lógica del cliente para main.html (Dashboard, OCR, etc.)
├── database/
│   └── setup.sql                # Script SQL histórico de respaldo
├── api/                         # Código backend en Python (FastAPI)
│   ├── main.py                  # Endpoints de la API, gestión de base de datos y sesiones
│   ├── database.db              # Base de datos SQLite local autogenerada
│   ├── requirements.txt         # Dependencias del backend de Python
│   └── fluxo_venv/              # Entorno virtual de Python para aislamiento de librerías
└── mds/                         # Carpeta dedicada a la documentación, planes y referencias
    ├── organizacion.md          # Esta guía explicativa
    ├── INICIO_AQUI.md           # Guía rápida inicial del OCR
    ├── DOCUMENTO_ENTREGA.md     # Reporte de la entrega del plan OCR
    ├── PLAN_RESUMEN.txt         # Resumen imprimible del plan OCR
    ├── README.md                # Presentación del plan de mejora OCR
    ├── INDEX_MAESTRO.md         # Mapa general de documentación del plan
    ├── QUICK_REFERENCE.txt      # Solución de problemas rápida del OCR
    ├── RESUMEN_EJECUTIVO.md     # Resumen gerencial del OCR
    ├── README_OCR_PLAN.md       # Plan ejecutivo detallado del OCR
    ├── OCR_IMPROVEMENT_PLAN.md  # Plan técnico completo y algoritmos del OCR
    ├── IMPLEMENTATION_GUIDE.md  # Guía paso a paso para implementar el OCR
    ├── OCR_IMPLEMENTATION_EXAMPLES.js # Ejemplos de código para el OCR
    ├── OCR_TEST_CASES.js        # Casos de prueba de la suite de validación
    └── OCR_PATTERNS.json        # Diccionario de patrones argentinos para OCR
```

---

## 2. ¿Por qué organizamos el proyecto así?

### A. Separación de Autenticación y Dashboard (`index.html` y `main.html`)
Dividir la interfaz en dos páginas HTML limpias e independientes aporta grandes beneficios:
- **`index.html` (Autenticación)**: Contiene únicamente el formulario de Login y Registro. Evita cargar componentes pesados del Dashboard antes de que el usuario haya iniciado sesión. Carga `js/auth.js` que maneja las peticiones de ingreso y redirige a `main.html` al tener éxito.
- **`main.html` (Dashboard principal)**: Es la interfaz interna donde se realiza la gestión. Protege su contenido: si `js/app.js` detecta que no hay una sesión activa, redirige automáticamente al usuario de vuelta a `index.html`.

### B. Separación de Responsabilidades (Concepto "Separation of Concerns")
En el desarrollo de software, es una buena práctica separar el contenido (HTML), el diseño (CSS), la interactividad (JavaScript) y la persistencia de datos (FastAPI/SQLite):
- **HTML (`index.html` y `main.html`)**: Define únicamente la estructura de la interfaz (la barra lateral, el dashboard, las tablas y los modales).
- **CSS (`css/styles.css`)**: Contiene los colores, márgenes, transiciones de pantalla, y efectos visuales de la aplicación.
- **JavaScript (`js/auth.js` y `js/app.js`)**: `auth.js` maneja el formulario de acceso; `app.js` maneja el estado local del usuario (transacciones, presupuestos), controla los eventos de clic y realiza el escaneo OCR.
- **Backend y persistencia (`api/main.py` y `api/database.db`)**: Centraliza la lógica en Python usando FastAPI y almacena la información de usuarios en una base de datos SQLite relacional y liviana.

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
