# App Spec — va360-app-raiola

**Última actualización:** 2026-10-23T16:56:38Z
**Versión del documento:** 1
**Mantenido por:** /app-init (idempotente) y eventos del pipeline

---

<!-- @specbox:zone start kind="auto" id="stack" auto_sync_on="lockfile_change,framework_detected,release_version_bump" -->
## 1. Stack

| Capa | Tecnología | Versión | Detectado de |
|------|------------|---------|--------------|
| Frontend + backend | React con Next.js | por definir | /app-init (respuesta del usuario) |
| Base de datos | SQLite | por definir | /app-init (respuesta del usuario) |
| Empaquetado | Docker (un solo contenedor) | por definir | /app-init (respuesta del usuario) |
| Despliegue | Coolify | — | /app-init (respuesta del usuario) |

> Aún no hay lockfiles (`package.json`) en el repo; versiones pendientes de la primera instalación.
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="auto" id="tracking_backend" auto_sync_on="set_auth_token" -->
## 2. Tracking backend

- **Tipo:** freeform
- **Path absoluto** (si freeform): C:/Users/valen/Documents/Demos/VA360_App_Raiola/doc/tracking
- **Reporting externo:** no

> Esta zona la mantiene el engine. Si el usuario cambia el backend, llamar `/app-init --refresh` o esperar al evento set_auth_token.
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="manual" id="brand_visual" -->
## 3. Brand & Visual

- **Brand kit:** `doc/design/brand_kit.md` (referencia)
- **VEG arquetipo:** {Corporate | Startup | Creative | Consumer | Gen-Z | Gobierno}
- **Modo VEG:** {uniforme | per_profile | per_icp}
- **Stitch project_id:** {id si configurado}
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="manual" id="conventions" -->
## 4. Convenciones del proyecto

- **Naming:** US-XX, UC-XXX, AC-XX
- **Tests:** {framework + dir}
- **E2E:** {Playwright | Patrol | Maestro | API}
- **Lint:** {tooling + reglas}
- **Deployment:** contenedor Docker único desplegado en Coolify {pipeline + branches por definir}
- **Multirepo:** no
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="auto" id="autopilot" auto_sync_on="autopilot_config_change" -->
## 5. Autopilot

- **Level:** equilibrado
- **Image budget €/feature:** 5
- **Auto-confirm overrides:** []
- **Always-ask overrides:** []
- **Queue enabled:** no configurado (default del engine)

> Esta zona se sincroniza automáticamente desde `.claude/settings.local.json`. Para cambiar la política, edita ese archivo y `/app-sync --refresh`.
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="hybrid" id="canonical_decisions" merge="append_only" -->
## 6. Decisiones canónicas

- Stack: Next.js (React) + SQLite en un solo contenedor Docker, desplegado en Coolify.
- Clave de Anthropic en `.env` (ignorado por git); plantilla pública en `.env.example`.

<!-- engine-entries-below -->
{(vacío hasta que la Capa 4 detecte 3 confirmaciones consecutivas idénticas)}
<!-- @specbox:zone end -->
