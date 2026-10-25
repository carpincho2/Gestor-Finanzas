# 🗺️ Roadmap del Proyecto: Gestor de Finanzas

Este documento detalla el estado actual del proyecto (enfocado 100% en la **Plataforma Web Responsive + Backend FastAPI**) y las funcionalidades evolucionadas para producción.

---

## ⚙️ 1. Backend (FastAPI) y Base de Datos
Tenemos la lógica financiera, las migraciones automáticas y el failover de base de datos listos:

- [x] **Seguridad Real (JWT / Session Auth):** Endpoints robustos de login, registro y autenticación con Google OAuth2.
- [x] **Resiliencia de Base de Datos (PostgreSQL / SQLite):** Failover automático a SQLite local si la instancia cloud de PostgreSQL no está disponible, y migraciones aisladas por columna.
- [x] **Motor OCR de Tickets:** Servicio en Python (`services/ocr.py`) y cliente Tesseract.js que leen los ítems del ticket y los devuelven como transacciones categorizadas.
- [ ] **Historial de Decisiones Inteligentes:** Guardar en la base de datos cada vez que la calculadora recomienda un pago para reportes de ahorro mensual.
- [ ] **Webhooks de Mercado Pago (Opcional):** Recepción automática de notificaciones de pago en tiempo real.

---

## 💻 2. Frontend Web Responsive (ES6 / TypeScript / HTML / CSS)
La plataforma web es 100% adaptable a computadoras de escritorio, tablets y teléfonos móviles desde el navegador:

- [x] **Consolidar el Dashboard:** Gráficos principales y módulos conectados a la API en Python con soporte offline/local.
- [x] **Diseño 100% Responsive:** Menú hamburguesa, tablas adaptables y vistas móviles completas desde el navegador web (reemplazando la necesidad de mantener una app nativa separada en Flutter).
- [x] **Flujo de Importación y Escáner en Vivo:** Importación de resúmenes bancarios y lector de códigos de barras por cámara (`BarcodeDetector`).

---

## 🚀 3. Lanzamiento y DevOps
- [x] **Pruebas Automatizadas (Testing):** Batería de tests unitarios en Python (`pytest`) para cuentas, presupuestos, metas, SEPA y motor de recomendación financiera.
- [x] **Despliegue Continuo en Render:** Servicio unificado (Frontend + Backend FastAPI) desplegado automáticamente desde `origin/main`.
