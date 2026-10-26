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
| 5. Bandeja con filtros, revisión con fuentes, envío automático y ajustes | Hecha |
| 6. Contenedor Docker para Coolify y pruebas de aceptación | Hecha |

## Ejecutar en local

Requisitos: Node.js 24 o superior.

1. Copia `.env.example` como `.env` y rellena `ANTHROPIC_API_KEY` y `ADMIN_PASSWORD`.
2. Instala y arranca con un solo comando:

   ```bash
   npm install && npm run dev
   ```

3. Abre http://localhost:3000 y entra con la clave de administración.

En el primer arranque se crea la carpeta `data/` con la base de datos y los secretos que falten. Esa carpeta no se sube a GitHub.

## Datos de demostración

En el primer arranque, si no hay ningún documento, la aplicación carga los cinco de la clínica de ejemplo, Fisioterapia Ribera Viva, y pone su nombre. Los documentos están en [`demo/documentos/`](demo/documentos/): tarifas, horarios, política de citas, preguntas frecuentes y tratamientos. Así, un despliegue nuevo se puede enseñar en cuanto arranca.

La carga se hace una sola vez. Si después borras esos documentos, no vuelven al reiniciar, y una instalación que ya tiene documentos no se toca. Para empezar vacía, define `DEMO_DATOS=false`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 3000 |
| `npm run build` y `npm start` | Build de producción y servidor |
| `npm test` | Tests unitarios y de integración (Vitest) |
| `npm run test:e2e` | Build y pruebas de aceptación (Playwright): un test por criterio del PRD y auditoría de accesibilidad con axe. Usa una carpeta de datos nueva y el modelo de pruebas, sin coste de Claude. La primera vez: `npx playwright install chromium` |
| `npm run lint` · `npm run typecheck` | ESLint y TypeScript |

## Desplegar en Coolify

La aplicación es un único contenedor (Next.js en modo standalone + SQLite) con los datos en el volumen `/data`.

1. En Coolify, crea un recurso nuevo desde este repositorio de GitHub con el build pack **Dockerfile**.
2. **Puerto**: `3000`.
3. **Almacenamiento persistente**: un volumen montado en `/data` (base de datos, documentos subidos y secretos generados). Sin él, los datos se pierden al redesplegar.
4. **Variables de entorno**:

   | Variable | Obligatoria | Para qué |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | Sí | Redactar las respuestas con Claude |
   | `ADMIN_PASSWORD` | Sí | Entrar al panel |
   | `ANTHROPIC_MODEL` | No | Otro modelo de Claude (por defecto `claude-opus-5-5`) |
   | `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Para conectar WhatsApp | Verificación del webhook en Meta y firma de los mensajes |
   | `EMAIL_WEBHOOK_TOKEN` | Para conectar el correo | Token del webhook de correo entrante |
   | `SESSION_SECRET` | No | Firma de la sesión (si falta, se genera y se guarda en `/data`) |
   | `APP_TIMEZONE` | No | Zona horaria del panel (por defecto `Europe/Madrid`) |
   | `DEMO_DATOS` | No | `false` para arrancar sin los documentos de la clínica de ejemplo |

   Los tokens de los webhooks que no definas se generan solos y no se muestran en el panel: para conectar WhatsApp o un proveedor de correo reales, defínelos tú para poder copiarlos en Meta o en el proveedor.
5. **Health check**: ruta `/api/health` (la imagen ya trae un `HEALTHCHECK`).
6. **Réplicas**: una. La cola de redacción se procesa dentro del propio proceso.

Para probar la imagen en local:

```bash
docker build -t va360-app-raiola . && docker run -p 3000:3000 -v va360-data:/data -e ADMIN_PASSWORD=elige-una-clave -e ANTHROPIC_API_KEY=tu-clave va360-app-raiola
```

## Cómo se redacta cada respuesta

Cada mensaje nuevo entra en una cola que procesa el propio servidor. Claude (por defecto `claude-opus-5-5`, cambiable con `ANTHROPIC_MODEL`) recibe los documentos listos de la clínica, con las citas nativas de la API activadas y caché de prompt, y redacta la respuesta en el idioma del paciente.

El borrador queda **listo** solo si cita los documentos y cada precio, hora, fecha o cifra que contiene aparece en el texto citado. Si no, el mensaje pasa a **Requiere revisión** con el motivo: «No hay información en los documentos», «Consulta clínica», «Dato no encontrado en los documentos» o «No se pudo generar el borrador» (este último se puede reintentar).

Para pruebas sin coste, `DRAFT_MODEL=fake` usa un modelo determinista que responde con la línea del documento que más se parece a la pregunta.

## Revisión y envío

En la **Bandeja** cada mensaje muestra su conversación y la respuesta propuesta con sus fuentes numeradas (cada una abre el fragmento del documento con el texto citado resaltado). Se puede aprobar tal cual, editar, escribir desde cero o descartar (y reabrir). Cada envío queda marcado como «Aprobada sin cambios», «Editada» o «Escrita a mano», y la bandeja muestra el porcentaje de aprobadas sin cambios de los últimos 7 días.

En **Ajustes** se activa el envío automático (desactivado por defecto): las respuestas respaldadas por los documentos se envían solas y los mensajes que necesitan revisión reciben una sola vez el aviso de recepción. En esta versión los envíos son **simulados**: quedan registrados y se ven en el simulador, pero no salen por WhatsApp ni por email.

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
