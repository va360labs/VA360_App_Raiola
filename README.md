# VA360_App_Raiola

Respuestas automáticas para clínicas pequeñas: los mensajes de WhatsApp y email llegan a una bandeja única y Claude prepara la respuesta citando los documentos de la clínica (tarifas, horarios, políticas y preguntas frecuentes). Lo que no está en los documentos pasa a una persona.

Demo del webinar VA360 × Raiola. Producto, discovery, PRD y plan en [`doc/`](doc/).

## Estado

| Fase del plan | Estado |
|---|---|
| 1. Base: proyecto, base de datos, comprobación de estado y acceso | Hecha |
| 2. Documentos: subida (PDF, DOCX, TXT, Markdown), reemplazo y borrado | Hecha |
| 3. Entrada de mensajes: webhooks de WhatsApp Cloud API y correo (Postmark), simulador | Hecha |
| 4. Redacción con citas (Claude), escalado a una persona y reintento | Hecha |
| 5. Bandeja, revisión y envío automático | Pendiente |
| 6. Contenedor Docker para Coolify y pruebas de aceptación | Pendiente |

## Ejecutar en local

Requisitos: Node.js 22 o superior.

1. Copia `.env.example` como `.env` y rellena `ANTHROPIC_API_KEY` y `ADMIN_PASSWORD`.
2. Instala y arranca con un solo comando:

   ```bash
   npm install && npm run dev
   ```

3. Abre http://localhost:3000 y entra con la clave de administración.

En el primer arranque se crea la carpeta `data/` con la base de datos vacía y los secretos que falten. Esa carpeta no se sube a GitHub.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 3000 |
| `npm run build` y `npm start` | Build de producción y servidor |
| `npm test` | Tests unitarios y de integración (Vitest) |
| `npm run lint` · `npm run typecheck` | ESLint y TypeScript |

## Cómo se redacta cada respuesta

Cada mensaje nuevo entra en una cola que procesa el propio servidor. Claude (por defecto `claude-opus-5-5`, cambiable con `ANTHROPIC_MODEL`) recibe los documentos listos de la clínica, con las citas nativas de la API activadas y caché de prompt, y redacta la respuesta en el idioma del paciente.

El borrador queda **listo** solo si cita los documentos y cada precio, hora, fecha o cifra que contiene aparece en el texto citado. Si no, el mensaje pasa a **Requiere revisión** con el motivo: «No hay información en los documentos», «Consulta clínica», «Dato no encontrado en los documentos» o «No se pudo generar el borrador» (este último se puede reintentar).

Para pruebas sin coste, `DRAFT_MODEL=fake` usa un modelo determinista que responde con la línea del documento que más se parece a la pregunta.

## Webhooks

| Canal | URL | Autenticación |
|---|---|---|
| WhatsApp Cloud API | `/api/webhooks/whatsapp` (GET para la verificación de Meta, POST para los mensajes) | Token de verificación `WHATSAPP_VERIFY_TOKEN`; firma `X-Hub-Signature-256` si se define `WHATSAPP_APP_SECRET` |
| Correo entrante (formato Postmark) | `/api/webhooks/email` | Cabecera `X-Webhook-Token` o `?token=` con `EMAIL_WEBHOOK_TOKEN` |

Si no defines los tokens, la aplicación los genera y los guarda en `data/secrets.json`. Los mensajes repetidos (mismo identificador) se guardan una sola vez. El **Simulador** del panel envía mensajes de prueba por estos mismos webhooks.

## Comprobación de estado

`GET /api/health` responde `200 {"status":"ok"}` si la base de datos está accesible y `503` si no. Es la ruta que usará Coolify para vigilar el contenedor.

## Seguridad

- El panel y todas sus operaciones exigen sesión; solo quedan abiertos el inicio de sesión, los webhooks y la comprobación de estado.
- La sesión dura 7 días. Tras 5 intentos fallidos en un minuto desde la misma IP hay que esperar 60 segundos.
- La clave de Anthropic y la de administración solo viven en `.env` (ignorado por Git) o en las variables de entorno del servidor.
