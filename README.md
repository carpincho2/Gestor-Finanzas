# Flujo Finance Manager & SEPA Price Comparator 🚀

Gestor de finanzas personales, asistente de compras inteligente y comparador de precios SEPA (Sistema Electrónico de Publicidad de Precios Argentinos), con versiones Web y App Móvil (Flutter).

---

## 📁 Estructura del Proyecto

```
Gestor de Finanzas/
├── api/                    # 🐍 Backend FastAPI (Python)
│   ├── main.py             # Punto de entrada Uvicorn/FastAPI
│   ├── models.py           # Modelos de Base de Datos (SQLAlchemy)
│   ├── database.py         # Configuración y conexión SQLite/PostgreSQL
│   ├── routers/            # Endpoints por módulo (auth, accounts, shopping, sepa, etc.)
│   ├── services/           # Lógica de negocio (SEPA, OCR, recomendaciones)
│   └── requirements.txt    # Dependencias de Python
│
├── mobile/                 # 📱 Aplicación Móvil (Flutter)
│   ├── lib/                # Código fuente Dart (screens, providers, services)
│   └── pubspec.yaml        # Dependencias de Flutter
│
├── js/                     # 🌐 Módulos JS Frontend (Web)
│   ├── app.js              # Entrypoint cliente
│   ├── shopping.js         # Asistente de Compras Inteligente
│   └── supermercados.js    # Buscador de precios SEPA
│
├── html/                   # 📄 Vistas y Plantillas HTML
│   └── views/              # Vistas dinámicas (dashboard, shopping, supermercados)
│
├── css/                    # 🎨 Estilos CSS Vanilla
├── releases/               # 📦 Compilaciones de la App (Archivos .apk)
├── index.html              # Landing / Login Web
└── main.html               # Aplicación Principal Web
```

---

## ⚡ Inicio Rápido

### 1. Backend (Python / FastAPI)
```bash
# Iniciar con el ejecutable automatizado:
.\iniciar_backend.bat

# O manualmente:
cd api
python -m venv fluxo_venv
.\fluxo_venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. App Móvil (Flutter)
```bash
cd mobile
flutter pub get
flutter run
```

---

## 🔑 Endpoints Principales del Backend

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/shopping/analyze-url` | Analiza producto de Mercado Libre y recomienda mejor pago |
| GET | `/api/precios` | Búsqueda de precios SEPA por EAN y geolocalización |
| POST | `/api/precios/ingesta/trigger` | Dispara ingesta manual del SEPA |
| GET | `/api/accounts` | Obtiene cuentas y saldo del usuario |

---
