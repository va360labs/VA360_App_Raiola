# Discovery: respuestas-automaticas

**Discovery ID**: disc-ecf79a5426e0
**Created**: 2026-10-23T17:00:58.195346+00:00
**Status**: READY_FOR_PRD
**Mode**: bootstrap
**Source of inheritance**: doc/app/app_market.md (creado en este mismo flujo, firma a481cac3…)

## ICPs involucrados

- **ICP-1: Clínica de fisioterapia pequeña con la recepción saturada** — heredado de `app_market.md`. Recibe cada día por WhatsApp y email las mismas preguntas sobre precios, horarios y cancelaciones; fuera de horario los mensajes se quedan sin respuesta.
  - Sanity check "3 personas concretas": **tentative** (perfil aportado por el product owner, sin 3 clínicas nombradas todavía).
- **ICP-2: Persona de recepción que atiende a los pacientes** — heredado de `app_market.md`. Es quien revisa y aprueba lo que no esté claro.
  - Sanity check "3 personas concretas": **tentative** (mismo origen que el ICP-1).

## JTBDs racionales

- **JR-F1.1 [ICP-1]** (deriva de JR-1.1): Cuando un paciente pregunta por WhatsApp o email por precios, horarios o cancelaciones, quiero que la respuesta llegue preparada con los datos de los documentos de la clínica, para contestar en segundos sin buscar nada.
- **JR-F1.2 [ICP-1]** (deriva de JR-1.2): Cuando llega un mensaje fuera de horario, quiero que el paciente reciba una respuesta correcta o un aviso claro de cuándo se le atenderá, para que ningún mensaje se quede sin contestar.
- **JR-F1.3 [ICP-1]** (deriva de JR-1.3): Cuando cambia un precio, un horario o la política de cancelación, quiero actualizarlo en un único sitio, para que las respuestas siguientes usen el dato vigente.
- **JR-F1.4 [ICP-2]** (deriva de JR-2.1): Cuando la pregunta no está cubierta por la información de la clínica, quiero que la propuesta se marque para revisión en lugar de inventarse, para no dar nunca un precio u horario falso.
- **JR-F1.5 [ICP-2]** (deriva de JR-2.2): Cuando reviso una propuesta marcada, quiero ver de qué documento sale cada dato y poder aprobarla o corregirla, para resolverla en pocos segundos.

## JTBDs emocionales

- **JE-F1.1 [ICP-1]** (deriva de JE-1.1): Tranquilidad — confiar en que la herramienta nunca promete un precio, horario o condición que la clínica no ofrece.
- **JE-F1.2 [ICP-1]** (deriva de JE-1.2): Alivio — dejar de sentir que los mensajes se acumulan y que se pierden pacientes fuera de horario.
- **JE-F1.3 [ICP-2]** (deriva de JE-2.1): Control — sentir que la persona de recepción decide lo dudoso y que la herramienta trabaja para ella, no en su lugar.

## Validation evidence

- **Tipo**: waiver explícito.
- **Razón**: el problema y el trabajo a resolver los describe el product owner a partir de su conocimiento del sector (clínicas pequeñas con recepción saturada y preguntas repetidas por WhatsApp y email). No hay entrevistas con clínicas registradas ni datos de mercado adjuntos, y no se han simulado.
- **Por qué es razonable seguir**: la funcionalidad es el núcleo de una demo y su riesgo principal (responder con datos inventados) se controla con la revisión humana obligatoria de lo dudoso.
- **Acción de seguimiento**: antes de una v1 pública, validar los JTBDs con al menos 3 clínicas de fisioterapia reales y convertir los ICPs de `tentative` a confirmados.

## Drift from app_market

- **Nuevos ICPs introducidos**: ninguno (ICP-1 e ICP-2 están en `app_market.md`).
- **Nuevos JTBDs introducidos**: ninguno (cada JR-F1.x / JE-F1.x deriva de un JTBD global de `app_market.md`).
- **Resolución**: no_drift

## Verdict

**READY_FOR_PRD** — todas las secciones completas; drift resuelto como `no_drift`; evidencia cubierta con waiver documentado.

---

> Este artefacto se completa interactivamente via el skill `/discovery`.
> Tras completarlo, `validate_discovery_completeness` actualizará el verdict
> a `READY_FOR_PRD` cuando todas las secciones estén llenas.
