# Publica tu aplicación con Coolify, paso a paso

Son los pasos que seguimos en el directo de Raiola. Valen para la aplicación de la demo y para la tuya, si tiene un `Dockerfile`.

## Antes de empezar

Necesitas tres cosas:

1. **Un servidor (VPS)** con 2 núcleos y entre 2 y 4 GB de memoria. Por ejemplo, un VPS Cloud de Raiola.
2. **Un dominio o un subdominio**, por ejemplo `respuestas.tudominio.com`.
3. **Tu clave de Anthropic.** Se crea en console.anthropic.com, en el apartado API Keys.

## Paso 1. Instala Coolify en el servidor

1. Entra en el servidor. Desde PowerShell o desde el Terminal del Mac, escribe esto con la IP que te da tu proveedor:

   ```
   ssh root@IP-DE-TU-SERVIDOR
   ```

2. Pega esta orden y espera a que termine:

   ```
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
   ```

3. Abre en el navegador `http://IP-DE-TU-SERVIDOR:8000` y crea tu usuario.

## Paso 2. Apunta tu dominio al servidor

En el panel donde compraste el dominio, crea un registro **A**:

- **Nombre:** `respuestas`
- **Valor:** la IP de tu servidor

## Paso 3. Crea la aplicación

1. En Coolify, ve a **Projects → + Add** y ponle un nombre.
2. Entra en el proyecto y pulsa **+ New → Public Repository**. Si te pregunta por el servidor, elige `localhost`.
3. Rellena el formulario:
   - **Repository URL:** `https://github.com/va360labs/VA360_App_Raiola`
   - **Branch:** `main`
   - **Build Pack:** **Dockerfile**
   - **Ports Exposes:** `3000`
4. Pulsa **Continue**.

## Paso 4. Pon tu dirección

En **Domains**, escribe tu dominio **empezando por https://**, por ejemplo `https://respuestas.tudominio.com`. Después pulsa **Save**.

Coolify propone una dirección de prueba que empieza por `http://` y termina en `sslip.io`. Si la usas, cámbiale también el `http://` por `https://`. Con `http://`, la pantalla de acceso vuelve a salir sin dar ningún error, aunque la contraseña sea correcta: por seguridad, la sesión solo funciona con HTTPS.

## Paso 5. Pon las claves

En **Environment Variables**, añade estas dos:

| Nombre | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | tu clave de Anthropic |
| `ADMIN_PASSWORD` | la contraseña con la que entrarás |

Nunca pongas estas claves en el código ni las enseñes en pantalla.

## Paso 6. Guarda los datos

En **Persistent Storage**, pulsa **+ Add** y elige **Volume Mount**:

- **Name:** `datos`
- **Destination Path:** `/data`

Sin este paso, los datos se borran cada vez que vuelves a desplegar.

## Paso 7. Despliega

Pulsa **Deploy**. En unos minutos, el estado cambia a **Running**.

## Paso 8. Comprueba que funciona

1. Abre `https://respuestas.tudominio.com/api/health`. Tiene que poner `{"status":"ok"}`.
2. Abre `https://respuestas.tudominio.com` y entra con tu contraseña.
3. La primera vez, la app ya trae cargados los cinco documentos de una clínica inventada, Fisioterapia Ribera Viva: los ves en **Documentos**, todos en «Listo». Manda un mensaje de prueba desde el **Simulador**, por ejemplo «¿Cuánto cuesta una sesión de fisioterapia?». En la **Bandeja** sale la respuesta (45 €) con sus fuentes.
4. Para usarla con tu negocio, borra esos documentos en **Documentos** y sube los tuyos. Si prefieres que arranque vacía, añade antes la variable `DEMO_DATOS=false`.

## Si algo no va

- **No te deja entrar.** Abre la dirección con `https://`, no con `http://`.
- **Sale «No available server».** Comprueba que el puerto sea `3000` y que la opción **Healthcheck** de Coolify esté desactivada.
- **El despliegue se corta a medias.** Al servidor le falta memoria: usa uno de 4 GB.
- **No aparecen los documentos de ejemplo.** Solo se cargan la primera vez que la app arranca con el volumen vacío. Si ya habías desplegado antes, borra el volumen en **Persistent Storage** y pulsa **Redeploy**.
- **La respuesta dice que no hay información.** Mira en **Documentos** que los cinco estén en «Listo».

## Para que siga funcionando

- En uptimerobot.com, crea un aviso gratis que vigile `https://respuestas.tudominio.com/api/health`.
- En Coolify, entra en **Notifications** y activa los avisos por email o por Telegram.
