# VA360_App_Raiola

Respuestas automáticas para clínicas pequeñas: los mensajes de WhatsApp y email llegan a una bandeja única y Claude prepara la respuesta citando los documentos de la clínica (tarifas, horarios, políticas y preguntas frecuentes). Lo que no está en los documentos pasa a una persona.

Demo del webinar VA360 × Raiola. Producto, discovery, PRD y plan en [`doc/`](doc/).

## Estado

| Fase del plan | Estado |
|---|---|
| 1. Base: proyecto, base de datos, comprobación de estado y acceso | Hecha |
| 2. Documentos | Pendiente |
| 3. Entrada de mensajes y simulador | Pendiente |
| 4. Redacción con citas | Pendiente |
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

## Comprobación de estado

`GET /api/health` responde `200 {"status":"ok"}` si la base de datos está accesible y `503` si no. Es la ruta que usará Coolify para vigilar el contenedor.

## Seguridad

- El panel y todas sus operaciones exigen sesión; solo quedan abiertos el inicio de sesión, los webhooks y la comprobación de estado.
- La sesión dura 7 días. Tras 5 intentos fallidos en un minuto desde la misma IP hay que esperar 60 segundos.
- La clave de Anthropic y la de administración solo viven en `.env` (ignorado por Git) o en las variables de entorno del servidor.
