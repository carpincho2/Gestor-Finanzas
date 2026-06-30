# 🔐 Seguridad de Tokens: Cifrado Fernet

En esta guía te explicamos cómo aseguramos la confidencialidad de las credenciales de los usuarios en el proyecto **Flujo**. Guardar tokens de acceso en texto plano es una de las vulnerabilidades más críticas (y comunes) en aplicaciones que interactúan con APIs externas, ya que si un atacante compromete la base de datos, obtiene acceso total a las cuentas bancarias o billeteras de los usuarios.

---

## 🛑 El Problema del Texto Plano

En la primera iteración del proyecto, los tokens de Mercado Pago se guardaban directamente en la columna `mp_token` de la tabla `accounts`.

Si alguien descargaba el archivo `database.db`, podía leer los tokens directamente. Un token de acceso de OAuth 2.0 es equivalente a una llave maestra temporal para la cuenta de Mercado Pago del usuario.

## ✅ La Solución: Cifrado Simétrico (Fernet)

Para solucionar esto, implementamos **cifrado simétrico autenticado** usando el módulo `cryptography.fernet` de Python.

### ¿Por qué Fernet?
Fernet es un estándar de cifrado que garantiza que un mensaje no puede ser leído ni manipulado sin la llave maestra. Utiliza:
*   **AES-128-CBC** para la confidencialidad (cifrado).
*   **HMAC-SHA256** para la autenticación e integridad (asegura que nadie alteró el token cifrado en la base de datos).

### ¿Cómo funciona en el proyecto?

1.  **La Llave Maestra (`ENCRYPTION_KEY`)**: 
    Todo el sistema depende de una única llave secreta de 32 bytes codificada en URL-safe base64. Esta llave **nunca** se guarda en el código fuente. Se configura en las variables de entorno (`.env` localmente o en el dashboard de Render en producción). Si el servidor se apaga y se roba la base de datos, los datos son inútiles sin esta llave.
2.  **`TokenEncryptionService`**:
    Creamos una clase en `api/main.py` encargada de manejar la lógica. Tiene métodos `encrypt()` y `decrypt()`.
3.  **Flujo de Guardado (Cifrado)**:
    Cuando recibimos un token de Mercado Pago (vía OAuth o ingreso manual), lo pasamos por `encrypt()`. Lo que se guarda en la tabla `wallet_connections` (o en la antigua columna `mp_token`) es un galimatías (ciphertext) que empieza típicamente con `gAAAAAB...`.
4.  **Flujo de Uso (Descifrado)**:
    Cuando el usuario hace clic en "Sincronizar", leemos el ciphertext de la base de datos, lo pasamos por `decrypt()` y obtenemos el token real para enviarlo a la API de Mercado Pago. Todo esto ocurre en memoria; el token real nunca toca el disco.

---

## 🛠️ Migración Automática de Datos

¿Qué pasó con los tokens que ya estaban guardados en texto plano antes de implementar el cifrado?

Para evitar romper el sistema o pedirle a los usuarios que vuelvan a cargar sus tokens, implementamos una **función de migración automática** (`migrate_plaintext_tokens()` en `main.py`).

Al arrancar el servidor de FastAPI, esta función:
1. Escanea la tabla antigua `accounts` buscando tokens no nulos.
2. Utiliza un método del servicio de criptografía (`is_encrypted()`) para detectar si el token ya está cifrado con Fernet o sigue en texto plano.
3. Si está en texto plano, lo cifra en el momento.
4. Mueve el token cifrado a la nueva y robusta tabla `wallet_connections`.

Este es un patrón de diseño excelente para aplicar cambios retroactivos de seguridad en sistemas en producción sin generar fricción en el usuario.
