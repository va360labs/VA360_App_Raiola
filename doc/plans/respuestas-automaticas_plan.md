# Plan: Respuestas automáticas con los documentos de la clínica

> Generado: 2026-10-23 · Estado: Pendiente
> Origen: `doc/prd/respuestas-automaticas/prd.md` (EP-01 · US-01…US-05 · UC-101…UC-502 · AC-01…AC-38)
> Discovery: `disc-ecf79a5426e0` · Diseño: `doc/design/DESIGN.md` + `doc/brand/brand_kit/` + `doc/veg/base/veg-va360-app-raiola.md`

## Context

El repo solo tiene documentación (PRD aprobado por el gate, discovery, brand kit). No hay código. Este plan es la salida de `/plan`: define cómo construir la v1 en Next.js + SQLite, en un solo contenedor para Coolify, cumpliendo los 38 AC. **Al aprobarlo, lo guardo como `doc/plans/respuestas-automaticas_plan.md` y me detengo**; la construcción va después con `/implement`, fase a fase. No hago commit hasta que lo pidas.

Decisiones tomadas sin preguntar (el usuario lo pidió): todas las de abajo, marcadas en «Alternativas y tradeoffs».

## Arquitectura en una frase

Un único proceso Next.js (App Router, runtime Node) sirve el panel, la API y los webhooks; guarda todo en SQLite (`/data/app.db`, modo WAL) y procesa la redacción en una cola dentro del mismo proceso, que llama a Claude con los documentos como bloques con **citas nativas**.

```
WhatsApp Cloud API ─┐                                   ┌─ Bandeja (polling 5 s)
Correo (Postmark) ──┼─► webhook ─► normalizar ─► SQLite ─┤
Simulador ──────────┘   (<2 s)     mensaje      + job    └─ Worker ─► Claude (docs + citas)
                                   común                       ─► comprobación de cifras
                                                               ─► borrador / revisión / envío simulado
```

## Stack (versiones fijadas al instalar)

Next.js 15 + React 19 + TypeScript · Tailwind CSS 4 (`@theme` mapeado a `doc/brand/brand_kit/variables.css`) · `better-sqlite3` (FTS5) · `@anthropic-ai/sdk` · `unpdf` (PDF) · `mammoth` (DOCX) · `zod` (validar payloads) · `jose` (cookie de sesión firmada) · `swr` (polling) · `lucide-react` (iconos) · Vitest · Playwright + `@axe-core/playwright`.

Antes de escribir la integración con Claude, cargar la skill `claude-api` para fijar los parámetros exactos de citas, caché de prompt y el ID de modelo.

## Modelo de datos (SQLite, migraciones SQL versionadas al arrancar)

| Tabla | Campos clave |
|---|---|
| `documents` | id, name, category, mime, size, status (`processing`/`ready`/`no_text`/`error`), text, version, timestamps |
| `chunks` + `chunks_fts` (FTS5, `unicode61 remove_diacritics 2`) | document_id, position, text — solo para el modo de selección (D4) |
| `contacts` | id, channel, external_id (teléfono / email), name |
| `messages` | id, contact_id, channel, direction (`in`/`out`), external_id **UNIQUE(channel, external_id)**, subject, body, kind (`text`/`unsupported`), simulated, status, previous_status, review_reason, received_at |
| `drafts` | message_id, text, citations (JSON: doc id, nombre, categoría, cited_text, start/end), grounded, reason, model, latency_ms |
| `outbox` | message_id, contact_id, channel, recipient, text, send_mode (`approved`/`edited`/`manual`/`auto`/`ack`), sent_at, simulated=1 |
| `jobs` | type (`draft`), payload, status, attempts, run_after, last_error |
| `settings` | `auto_send` (false), `ack_message`, `clinic_name` |
| `login_attempts` | ip, ts |

Estados del mensaje: `new` → (`drafting`, se muestra «Nuevo») → `draft_ready` | `needs_review` → `sent` | `discarded` (guarda `previous_status` para reabrir).

## Flujo de redacción (UC-301 / UC-302 — núcleo del producto)

1. Mensaje no textual → `needs_review` «Tipo de mensaje no soportado» (AC-11).
2. Construir la petición: system prompt (responder solo con los documentos, en el idioma del mensaje, nunca consejo clínico) + documentos `ready` como bloques `document` de texto con `title`=nombre, `context`=categoría, `citations.enabled`, `cache_control` en el último bloque + historial del contacto (máx. 10) + mensaje.
   - Si los documentos superan ~150.000 tokens (estimación chars/4): enviar los 20 fragmentos mejor puntuados por FTS5 como documentos de contenido propio (D4).
3. El modelo responde con texto citado, o con un marcador exacto `[[SIN_INFORMACION]]` / `[[CONSULTA_CLINICA]]` → `needs_review` con «No hay información en los documentos» (AC-24) / «Consulta clínica» (AC-25).
4. Salvaguardas deterministas (D6):
   - borrador sin ninguna cita → `needs_review` «No hay información en los documentos»;
   - **comprobación de cifras**: se extraen del borrador precios, horas, fechas, porcentajes y números (normalizando `40 €`/`40€`/`40,00 €`, `9:00`/`09:00 h`); cada uno debe aparecer en el `cited_text` de alguna cita → si no, `needs_review` «Dato no encontrado en los documentos» (AC-21).
5. Fallo de API o sin `ANTHROPIC_API_KEY` → `needs_review` «No se pudo generar el borrador» + «Reintentar» re-encola (AC-26).
6. Borrador válido → `draft_ready`. Si `auto_send`: enviar (`send_mode=auto`, «Enviado automáticamente», AC-31). Si `needs_review` y `auto_send`: un único aviso de recepción por mensaje (`send_mode=ack`, AC-32). Las consultas clínicas nunca se auto-responden con datos.

La interfaz `DraftModel` (real = Anthropic, falsa = determinista para tests y E2E con `DRAFT_MODEL=fake`) aísla la llamada.

## Entrada de mensajes

- `GET /api/webhooks/whatsapp`: `hub.mode=subscribe` y `hub.verify_token` correcto → devuelve `hub.challenge`; si no, 403 (AC-07).
- `POST /api/webhooks/whatsapp`: si hay `WHATSAPP_APP_SECRET`, verifica `X-Hub-Signature-256` (HMAC-SHA256 del cuerpo crudo, `timingSafeEqual`) → 401 si no coincide (AC-10). Valida con zod `entry[].changes[].value.{messages,contacts}`; ignora `statuses`. `INSERT OR IGNORE` por `wamid` (AC-09). Encola y responde 200 en <2 s (AC-08).
- `POST /api/webhooks/email`: token en cabecera `X-Webhook-Token` (o `?token=`) → 401 sin él (AC-13). Formato Postmark inbound (`FromFull`, `Subject`, `TextBody`, `StrippedTextReply`, `MessageID`); usa `StrippedTextReply` si viene. Dedupe por `MessageID` (AC-12/13).
- **Simulador** (UC-203): el servidor construye un payload con el formato real (WhatsApp Cloud API o Postmark) con IDs `wamid.SIM…` / `sim-…`, lo firma con los secretos internos y hace `fetch` a su propio webhook → mismo camino que un mensaje real; `simulated` se deduce del prefijo (AC-14).
- Secretos opcionales: si `WHATSAPP_VERIFY_TOKEN`, `EMAIL_WEBHOOK_TOKEN` o `SESSION_SECRET` no están definidos, se generan una vez y se guardan en `/data/secrets.json` (nunca se muestran en la UI). **Solo hace falta añadir `ADMIN_PASSWORD`** a la clave de Anthropic que ya tienes.

## Envío (simulado en v1)

Interfaz `Sender` con implementación `SimulatedSender` (escribe en `outbox` y cambia el estado). `WhatsAppSender` y `EmailSender` quedan para la fase 2 sin tocar la lógica de revisión.

## Acceso (UC-501)

`middleware.ts` protege todo salvo `/login`, `/api/auth/*`, `/api/webhooks/*`, `/api/health` y estáticos: páginas → redirección, API → 401 (AC-34). Login contra `ADMIN_PASSWORD`; cookie JWT (`jose`) httpOnly, SameSite=Lax, `Secure` en producción, 7 días; 5 fallos/min por IP → 429 durante 60 s (AC-35).

## Análisis UI (Fase 0)

Superficie Operate; estructura de bandeja de correo; fuente visual = Brand Kit + DESIGN.md (no hay tokens de sistema ni Stitch/Claude Design configurados → sin candidatos generados; las pantallas se diseñan en código siguiendo la VEG y se verifican con capturas en `/implement`).

| Requisito (PRD) | Componente | Acción |
|---|---|---|
| Navegación + contador de revisión | `AppShell`, `Sidebar` (barra inferior en móvil) | CREAR |
| Lista de mensajes 20-500/día, filtros canal/estado | `InboxList`, `MessageRow`, `InboxFilters`, `StatusChip`, `ChannelIcon` | CREAR |
| Detalle + historial | `MessageDetail`, `ConversationHistory` | CREAR |
| Borrador editable con citas (pieza propia) | `DraftEditor`, `CitationMark`, `CitationPopover` (fragmento resaltado en `#E2EBE3`, cifra sin respaldo subrayada en ámbar) | CREAR |
| Motivo de revisión + Reintentar | `ReviewReasonBanner` | CREAR |
| % aprobadas sin cambios 7 días | `ApprovalStat` (texto, sin métrica héroe) | CREAR |
| Documentos 5-50 + subida + borrar con confirmación | `DocumentsTable`, `UploadPanel`, `CategoryFilter`, `ConfirmDialog` | CREAR |
| Simulador | `SimulatorForm`, `SimulatedConversation` | CREAR |
| Ajustes (envío automático con confirmación, aviso) | `SettingsForm` | CREAR |
| Login, avisos, vacíos | `LoginForm`, `Toast`, `EmptyState` | CREAR |

Layout: escritorio barra lateral 232 px + lista 400 px + detalle; tablet barra de iconos + 40/60; móvil lista → detalle a pantalla completa con «Aprobar y enviar» fijo abajo.

## Fases de implementación

| Fase | Contenido | UC / AC | Est. |
|---|---|---|---|
| 1. Base | Scaffold Next + Tailwind 4 con tokens del brand kit y fuente Atkinson; SQLite + migraciones; `/api/health` 200/503; secretos persistidos; auth + middleware; `AppShell` | UC-501, UC-502 (AC-34…36, 38) | 6 h |
| 2. Documentos | Subida (≤10 MB, PDF/DOCX/TXT/MD), extracción, estado «Sin texto», troceado + FTS, reemplazo (versión) y borrado | UC-101, UC-102 (AC-01…06) | 8 h |
| 3. Entrada | Normalizadores WhatsApp/Postmark, webhooks con verificación, dedupe, cola de jobs, simulador | UC-201…203 (AC-07…15) | 12 h |
| 4. Redacción | Worker en `instrumentation.ts`, `DraftModel` real y falso, citas, comprobación de cifras, escalados, reintento | UC-301, UC-302 (AC-20…26) | 14 h |
| 5. Bandeja y revisión | Bandeja con filtros y polling, detalle, editor con citas, aprobar/editar/escribir/descartar/reabrir, estadística 7 días, Ajustes y envío automático + aviso | UC-204, UC-401, UC-402 (AC-16…19, 27…33) | 16 h |
| 6. Contenedor y QA | Dockerfile multi-etapa, README (local + Coolify), `.env.example` ampliado, E2E Playwright de los 38 AC, axe, cobertura | AC-37 + verificación global | 8 h |

Cada fase cierra con sus tests en verde y los AC marcados en el tablero FreeForm.

## Archivos a crear (principales)

```
app/(panel)/{bandeja,documentos,simulador,ajustes}/page.tsx · app/login/page.tsx
app/api/webhooks/{whatsapp,email}/route.ts · app/api/health/route.ts · app/api/{auth,messages,documents,settings,simulator}/…
middleware.ts · instrumentation.ts (arranca migraciones y worker)
lib/db/{index.ts,migrations/*.sql} · lib/config.ts (env + /data/secrets.json)
lib/documents/{extract.ts,chunk.ts,index.ts} · lib/inbox/{whatsapp.ts,email.ts,ingest.ts}
lib/drafting/{prompt.ts,model.ts,anthropic.ts,fake.ts,figures.ts,worker.ts} · lib/sending/{sender.ts,simulated.ts}
lib/auth/{session.ts,rateLimit.ts} · components/** (tabla de Análisis UI) · app/globals.css (importa tokens)
tests/unit/** · tests/integration/** · e2e/** · fixtures/{docs,whatsapp,email}/**
Dockerfile · .dockerignore · README.md · .env.example (solo nombres de variables, sin valores)
```

## Alternativas y tradeoffs

| Decisión | Elegida | Descartada | Razón |
|---|---|---|---|
| Recuperación | Documentos completos en contexto + caché; FTS5 si no caben | Embeddings + vector DB | Corpus pequeño; sin servicios extra; más exacto |
| Citas | API nativa de citas de Claude | JSON propio con IDs de fragmento | El texto citado viene del modelo, verificable carácter a carácter |
| Cola | Tabla `jobs` + worker en proceso | Redis/BullMQ | Un solo contenedor; volumen bajo |
| Sesión | Cookie JWT con `jose` | NextAuth | Una sola clave de admin; menos superficie |
| Tiempo real | Polling SWR 5 s | SSE/WebSockets | Cumple <10 s y es robusto detrás del proxy de Coolify |
| PDF | `unpdf` | `pdf-parse` | Mantenido, sin binarios nativos |
| Detección clínica | Marcador del modelo + salvaguarda «sin citas» | Clasificador aparte | Una sola llamada; el fallo cae siempre hacia revisión |

## Riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| `better-sqlite3` es nativo y la imagen falla al compilar | Etapa de build `node:22-bookworm-slim` con `python3 make g++`; `serverExternalPackages: ['better-sqlite3']`; copiar el módulo al runner |
| Worker duplicado con varias réplicas | Documentar réplicas = 1 en Coolify; jobs con bloqueo optimista por `status` |
| Comprobación de cifras con falsos positivos (p. ej. «2 sesiones») | Solo cifras con unidad o formato (€, %, h, hh:mm, fechas) y números ≥ 10; tests con casos reales |
| Coste de tokens con muchos documentos | Caché de prompt en el bloque de documentos; modo FTS por encima del umbral |

## Verificación

1. `npm run lint && npm run typecheck && npm test -- --coverage` (Vitest, ≥85 % en `lib/`).
2. Integración: webhooks con payloads oficiales de WhatsApp Cloud API y Postmark (verificación, firma, dedupe, <2 s) contra SQLite temporal.
3. E2E Playwright con `DRAFT_MODEL=fake`: un test por AC (subida, reemplazo 40 € → 45 €, simulador → bandeja, borrador con cita, parking → revisión, rodilla → consulta clínica, aprobar/editar/descartar, envío automático + aviso, login y bloqueo) + `axe` en Bandeja, Detalle y Documentos.
4. Prueba real con Claude (`@live`, usa la clave de `.env`): «¿Cuánto cuesta una sesión?» con `fixtures/docs/tarifas.md` → borrador con «40 €» y cita en <15 s.
5. Contenedor: `docker build` + `docker run -v data:/data -p 3000:3000`; subir documento, recibir mensaje, `docker restart`, comprobar que siguen; `GET /api/health` → `{"status":"ok"}`.
6. Navegador: capturas de Bandeja, Detalle con cita abierta y Documentos a 1440 y 390 px, revisadas contra el brand kit.

## Al aprobar

1. Guardar este plan en `doc/plans/respuestas-automaticas_plan.md`.
2. Comprobar que el plan no mete rutas ni secretos en ningún AC (los AC del tablero no cambian).
3. Parar y proponer `/implement` empezando por la Fase 1. Sin commit hasta que lo pidas.
