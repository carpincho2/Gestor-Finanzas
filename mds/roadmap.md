# 🗺️ Roadmap del Proyecto: Gestor de Finanzas

Este documento detalla el estado actual del proyecto y **todo lo que falta construir** para tener un producto 100% terminado, profesional y listo para salir al mercado (o ser usado en producción).

---

## 📱 1. Aplicación Móvil (Flutter)
Acabamos de generar la arquitectura base (`mobile/`), pero hay que darle vida a la app.

- [ ] **Conexión Backend-App:** Configurar el `HttpClient` (Dio o `http`) para que Riverpod se comunique fluidamente con tu servidor local (y futuro servidor en Render).
- [ ] **Lógica de la Calculadora de Compras:** Conectar la vista que armamos (`ShoppingScreen`) con el endpoint `POST /api/shopping/analyze-url` para que devuelva los cálculos de TNA y cuotas reales.
- [ ] **Escaneo de Tickets (OCR):** Implementar la cámara nativa usando el paquete `mobile_scanner` para leer los tickets de supermercado/restaurantes.
- [ ] **Maquetación del Dashboard:** Armar la pantalla de inicio con los gráficos de saldos, cuentas y tarjetas.
- [ ] **Autenticación (Login):** Armar la pantalla de inicio de sesión segura (Google Sign-In nativo de Android/iOS).

---

## ⚙️ 2. Backend (FastAPI) y Base de Datos
Tenemos la lógica financiera y las migraciones de Alembic listas. Faltan funcionalidades core.

- [ ] **Seguridad Real (JWT / Auth):** Actualmente la web delega parte de la validación. Hay que implementar endpoints robustos de login (JWT) para que la app móvil se conecte de forma 100% segura.
- [ ] **Motor OCR de Tickets:** Crear un servicio en Python (`services/ocr.py`) que reciba la foto desde Flutter, lea los ítems del ticket (con IA o tesseract) y los devuelva como transacciones separadas.
- [ ] **Historial de Decisiones Inteligentes:** Guardar en la base de datos cada vez que la calculadora recomienda un pago (para que puedas llevar un reporte de "Plata ahorrada este mes gracias al asistente").
- [ ] **Webhooks de Mercado Pago (Opcional):** Si en el futuro querés que el saldo se actualice solo, preparar la recepción automática de pagos.

---

## 💻 3. Frontend Web (JS/HTML)
La plataforma web actualmente es un excelente prototipo rápido.

- [ ] **Consolidar el Dashboard:** Asegurar que los gráficos principales consuman datos reales de la nueva API en Python (en vez del localStorage).
- [ ] **Flujo de Importación:** Mejorar la UI para cuando el usuario sube un CSV de su banco.
- [ ] **Despliegue a Producción:** Subir la web estática a un hosting profesional gratuito como Vercel o Netlify, apuntando al backend de Render.

---

## 🚀 4. Lanzamiento y DevOps
- [ ] **Pruebas Automatizadas (Testing):** Crear una batería de tests unitarios básicos en Python (pytest) para asegurar que la fórmula de cuotas y TNA nunca falle.
- [ ] **Compilar App:** Generar el archivo `.apk` o `.aab` de Flutter para instalarlo de forma permanente en tu Android o subirlo a la Play Store.
- [ ] **CI/CD:** Configurar GitHub Actions para que al hacer `git push`, se pasen los tests solos antes de actualizar el servidor.
