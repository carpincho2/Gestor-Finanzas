# 📘 Guía Paso a Paso: Configurar Mercado Pago (OAuth 2.0 y Webhooks)

¡Hola! Esta guía es el "manual de instrucciones" para conectar nuestro proyecto **Flujo** con la API real de Mercado Pago. 

Como estudiante, esto te servirá para entender cómo las aplicaciones del mundo real (como plataformas de e-commerce, o gestores financieros) se comunican de forma oficial y legal con procesadores de pago.

---

## 🛠️ Paso 1: Crear la Aplicación en Mercado Pago

Para que Mercado Pago sepa quién le está pidiendo información (y pueda darle permisos o bloqueos), necesitas registrar tu aplicación en su panel de desarrolladores.

1.  Ingresa al **Panel de Desarrolladores de Mercado Pago** de Argentina:
    *   URL: [https://www.mercadopago.com.ar/developers/panel/applications](https://www.mercadopago.com.ar/developers/panel/applications)
2.  Inicia sesión con tu cuenta de Mercado Pago o Mercado Libre.
3.  Haz clic en el botón **"Crear aplicación"** (o "Create application").
4.  Completa el formulario:
    *   **Nombre de la aplicación**: "Flujo Finanzas" (o el nombre que quieras).
    *   **¿Qué tipo de solución vas a integrar?**: Selecciona **"Pagos online"** o **"Otros"**.
    *   **¿Estás integrando un software para otra empresa?**: No (es para vos mismo/tus usuarios).
5.  Acepta los términos y condiciones y haz clic en **"Crear aplicación"**.

---

## 🔑 Paso 2: Obtener las Credenciales (Client ID y Secret)

Una vez creada la aplicación, Mercado Pago te asignará identificadores únicos. Estos son tu "usuario y contraseña" para que tu servidor (el backend de Flujo) se identifique ante Mercado Pago.

1.  Dentro de tu aplicación recién creada, ve al menú lateral izquierdo y busca **"Credenciales"** -> **"Credenciales de producción"**.
    *   *(Nota: También hay credenciales de prueba, pero para usar OAuth necesitaremos configurar las de producción eventualmente, aunque el entorno sea de desarrollo).*
2.  Verás dos datos muy importantes:
    *   **Client ID**: Es público, identifica a tu app (ej. `1234567890123456`).
    *   **Client Secret**: Es **PRIVADO**, es una contraseña larga. NUNCA la compartas ni la subas a GitHub.
3.  Abre tu archivo local `.env` en la carpeta `api/` de Flujo.
4.  Copia esos valores y pegalos así:
    ```env
    MP_CLIENT_ID=tu_client_id_aqui
    MP_CLIENT_SECRET=tu_client_secret_aqui
    ```

---

## 🔄 Paso 3: Configurar la URL de Redirección (OAuth Callback)

Para que el flujo OAuth 2.0 funcione, cuando el usuario autoriza a Flujo en la pantalla de Mercado Pago, Mercado Pago necesita saber **a dónde enviar al usuario de vuelta**.

1.  En el panel de tu aplicación de Mercado Pago, busca la sección **"OAuth"** o **"URLs de redirección"**.
2.  Allí verás un campo para ingresar **Redirect URIs** (URLs de redirección permitidas).
3.  **Para desarrollo local**, agrega:
    `http://localhost:8000/api/wallets/mercadopago/callback`
4.  **Para producción en Render** (cuando lo subas), deberás agregar también tu URL pública, por ejemplo:
    `https://tu-app-flujo.onrender.com/api/wallets/mercadopago/callback`
5.  Guarda los cambios en el panel de Mercado Pago.
6.  Asegúrate de que en tu `.env` esté configurada la URL que estás usando:
    ```env
    MP_REDIRECT_URI=http://localhost:8000/api/wallets/mercadopago/callback
    ```

---

## 🔔 Paso 4: Configurar los Webhooks (Notificaciones)

Para que Mercado Pago nos avise instantáneamente cada vez que el usuario hace o recibe un pago (sin que el usuario tenga que darle a "Sincronizar"), necesitamos configurar los Webhooks.

1.  En el panel de Mercado Pago, ve a **"Notificaciones"** -> **"Webhooks"**.
2.  Haz clic en **"Crear Webhook"**.
3.  **URL de producción**: Aquí debes poner la URL de tu servidor en Render (los webhooks **no funcionan** con `localhost` porque Mercado Pago no puede acceder a tu computadora privada, a menos que uses herramientas como *Ngrok*).
    *   Ejemplo: `https://tu-app-flujo.onrender.com/api/webhooks/mercadopago`
4.  **Eventos**: Selecciona la casilla **"Pagos"** (Payments). Solo nos interesan las transacciones.
5.  Guarda la configuración. Mercado Pago te generará una **"Clave secreta del webhook"** (Webhook Secret).
6.  Copia esa clave y agrégala a tu archivo `.env` para que nuestro servidor pueda verificar que las notificaciones son legítimas:
    ```env
    MP_WEBHOOK_SECRET=la_clave_secreta_del_webhook
    ```

---

## 🚀 Paso 5: Configurar Producción en Render

Cuando estés listo para probar esto en el mundo real (fuera de localhost), debes decirle a Render cuáles son estas variables (recuerda que el archivo `.env` no se sube a GitHub por seguridad).

1.  Entra a tu dashboard de [Render.com](https://dashboard.render.com/).
2.  Selecciona tu Web Service (Flujo).
3.  Ve a la pestaña **"Environment"** (Variables de entorno).
4.  Haz clic en **"Add Environment Variable"** y agrega:
    *   `MP_CLIENT_ID`: (Tu Client ID)
    *   `MP_CLIENT_SECRET`: (Tu Client Secret)
    *   `MP_REDIRECT_URI`: (Tu URL pública, ej: `https://.../api/wallets/mercadopago/callback`)
    *   `MP_WEBHOOK_SECRET`: (Tu clave de Webhook)
    *   `ENCRYPTION_KEY`: (Si no está creada, recuerda generarla con el comando de Python: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`)
5.  Guarda los cambios. Render reiniciará tu aplicación automáticamente.

---

### 🎉 ¡Listo!

Una vez completados estos pasos, cualquier usuario (tú, tus amigos) podrá:
1.  Hacer clic en "Conectar con Mercado Pago".
2.  Ser redirigido a la página oficial de MP para iniciar sesión.
3.  Volver automáticamente a Flujo con los datos sincronizados.
4.  Recibir sus nuevos gastos automáticamente gracias al Webhook.
