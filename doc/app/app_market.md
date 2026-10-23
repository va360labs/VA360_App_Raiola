# Mercado del producto — va360-app-raiola

**Última actualización:** 2026-10-23T17:00:58Z
**Versión del documento:** 1
**Mantenido por:** /discovery (modo bootstrap) y eventos de pipeline

---

> Documento canónico nivel producto. Cambia raramente. Define para quién es la app entera y qué jobs aborda. Cada feature individual hereda de este documento via `/discovery <feature_name>`.

<!-- @specbox:zone start kind="manual" id="icps_primary" -->
## 1. ICPs primarios

**ICP-1: Clínica de fisioterapia pequeña con la recepción saturada**
- **Perfil**: dueño/a o gerente de una clínica de 1 a 5 fisioterapeutas, con una o dos personas en recepción. Nivel técnico básico: usa WhatsApp Business, email y una agenda online.
- **Atributos diferenciadores**:
  1. Recibe cada día por WhatsApp y email las mismas preguntas sobre precios, horarios y cancelaciones.
  2. Los mensajes que llegan fuera de horario se quedan sin respuesta hasta el día siguiente.
  3. Un precio u horario mal dado le cuesta dinero o un paciente; no puede permitirse respuestas inventadas.
- **Watering hole**: colegios profesionales de fisioterapeutas, grupos de gestión de clínicas en LinkedIn y Facebook, ferias del sector salud y bienestar.
- **Sanity check "3 personas concretas"**: tentativo — perfil descrito por el product owner; queda por confirmar con 3 clínicas reales.

**ICP-2: Persona de recepción que atiende a los pacientes**
- **Perfil**: recepcionista o administrativo/a de esa clínica; contesta WhatsApp y email mientras atiende el mostrador y el teléfono.
- **Atributos diferenciadores**:
  1. Escribe a mano, una y otra vez, las mismas respuestas.
  2. Trabaja con interrupciones constantes; necesita resolver cada mensaje en segundos.
  3. Es quien responde ante el paciente si un dato es incorrecto.
- **Watering hole**: dentro de las propias clínicas del ICP-1 (se llega a través del dueño/a).
- **Sanity check "3 personas concretas"**: tentativo — mismo origen que el ICP-1.

> Ampliación prevista (no ICP en v1): academias y tiendas de servicios con el mismo patrón de preguntas repetidas, recogidas en la visión del producto.
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="manual" id="anti_icps" -->
## 2. No-ICPs (anti-mercado)

- **Hospitales, cadenas y grupos con call center**: ya tienen CRM, centralita y equipo dedicado; sus necesidades son de integración, no de una herramienta ligera.
- **Ecommerce de alto volumen**: sus preguntas dependen de pedidos y stock en tiempo real, no de documentos estables del negocio.
- **Negocios que quieren un bot 100 % autónomo sin revisión humana**: el producto se basa en que una persona decide lo dudoso.
- **Consultas clínicas o de diagnóstico**: el producto no da consejo sanitario; esas conversaciones las lleva siempre un profesional.
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="manual" id="jtbds_rational" -->
## 3. JTBDs racionales principales

**Para ICP-1 (clínica):**
- **JR-1.1**: Cuando llega una pregunta repetida sobre precios, horarios o cancelaciones, quiero tener ya preparada una respuesta con los datos reales de la clínica, para contestar en segundos sin buscar la información.
- **JR-1.2**: Cuando llega un mensaje fuera de horario, quiero que el paciente reciba una respuesta correcta o un aviso claro de cuándo se le atenderá, para no perder pacientes por falta de respuesta.
- **JR-1.3**: Cuando cambian los precios, los horarios o la política de cancelación, quiero actualizar la información una sola vez, para que todas las respuestas usen el dato vigente.

**Para ICP-2 (recepción):**
- **JR-2.1**: Cuando la información de la clínica no cubre una pregunta, quiero que la propuesta se marque para revisión en lugar de inventarse, para no dar nunca un dato falso.
- **JR-2.2**: Cuando reviso una propuesta, quiero ver de qué documento sale cada dato, para aprobarla o corregirla en pocos segundos.
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="manual" id="jtbds_emotional" -->
## 4. JTBDs emocionales principales

**Para ICP-1 (clínica):**
- **JE-1.1**: Tranquilidad — no temer que la herramienta prometa un precio, horario o condición que la clínica no ofrece.
- **JE-1.2**: Alivio — dejar de sentir que los mensajes se acumulan y que se pierden pacientes fuera de horario.

**Para ICP-2 (recepción):**
- **JE-2.1**: Control — sentir que la persona decide lo dudoso y que la herramienta trabaja para ella, no en su lugar.
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="manual" id="north_star_metric" -->
## 5. North Star Metric

**NSM**: porcentaje de mensajes de clientes contestados con información correcta en menos de 5 minutos (medido por semana y por negocio).

**Input metrics** (leading indicators):
- Porcentaje de propuestas aprobadas sin cambios por la recepción.
- Porcentaje de mensajes fuera de horario que reciben respuesta o aviso automático.
- Respuestas enviadas con datos no respaldados por los documentos del negocio (objetivo: 0).
- Tiempo medio de revisión de una propuesta marcada como dudosa.
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="manual" id="positioning" -->
## 6. Posicionamiento competitivo (opcional)

**Mensaje canónico**: *"Respuestas al instante con los datos de tu negocio, y una persona decide cuando hay dudas."*

Frente a responder a mano, las respuestas rápidas guardadas de WhatsApp Business y los chatbots genéricos:
- **Exactitud**: cada respuesta sale de los documentos del negocio; si no hay dato, no se inventa y se escala.
- **Rapidez sin perder control**: la propuesta está lista en segundos, pero lo dudoso pasa por una persona.
- **Mantenimiento mínimo**: se actualiza un documento, no decenas de plantillas.
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="manual" id="anti_features" -->
## 7. Principios anti-feature (opcional)

- **NO inventar datos**: si un precio, horario o condición no está en la información del negocio, la respuesta se marca para revisión.
- **NO dar consejo clínico**: las preguntas sanitarias se derivan siempre a un profesional.
- **NO enviar sin revisión lo que no esté claro**: el envío automático solo aplica a respuestas respaldadas por los documentos.
- **NO ser un sistema de reservas ni un CRM**: el producto responde preguntas; no gestiona la agenda.
<!-- @specbox:zone end -->

<!-- @specbox:zone start kind="auto" id="exportable_copy" auto_sync_on="app_market_icp_added,app_market_jtbd_added,nsm_updated" -->
## 8. Exportable copy (auto-derivado)

> Esta zona la mantiene el engine. Se regenera automáticamente cuando ICPs/JTBDs/NSM cambian.

### Landing headline
Contesta en segundos a tus pacientes, con tus precios y horarios reales.

### LinkedIn post template
¿Tu recepción contesta cada día las mismas preguntas por WhatsApp y email? Precios, horarios, cancelaciones… y los mensajes de fuera de horario esperan hasta mañana. Estamos construyendo una herramienta que prepara la respuesta con la información de tu clínica, no se inventa nada y deja en manos de tu equipo lo que no esté claro. Si diriges una clínica pequeña, nos encantaría hablar contigo.

### Elevator pitch (30 segundos)
Las clínicas pequeñas pierden horas contestando siempre lo mismo y pierden pacientes cuando nadie responde fuera de horario. Nuestra aplicación lee los documentos de la clínica y prepara al momento la respuesta a cada mensaje de WhatsApp o email. Si el dato está en sus documentos, responde; si no, lo marca para que una persona lo revise. Rápido, exacto y con el equipo siempre al mando.
<!-- @specbox:zone end -->

---

**Signature**: _(computada por record_app_docs_signature)_
**Last updated**: 2026-10-23T17:00:58Z
