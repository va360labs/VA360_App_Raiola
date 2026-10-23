# PRD: Respuestas automáticas con los documentos de la clínica

> Feature: `respuestas-automaticas` · Discovery: `disc-ecf79a5426e0` (READY_FOR_PRD)
> Generado: 2026-10-23 · Backend de seguimiento: FreeForm

## Descripción

Las clínicas pequeñas contestan cada día por WhatsApp y por email las mismas preguntas sobre precios, horarios y cancelaciones, y los mensajes que llegan fuera de horario se quedan sin respuesta. Esta funcionalidad reúne todos los mensajes en una bandeja única y, para cada uno, prepara una respuesta redactada por Claude a partir de los documentos que la clínica ha subido (tarifas, horarios, políticas y preguntas frecuentes), citando de qué documento sale cada dato.

Si la información no está en los documentos, la aplicación no se la inventa: marca el mensaje para que lo revise una persona. La persona de recepción puede revisar y aprobar cada respuesta o activar el envío automático para las respuestas respaldadas por los documentos.

## Objetivo

Que la clínica conteste en menos de 5 minutos, con datos correctos y citados, la mayoría de las preguntas repetidas, y que todo lo dudoso pase por una persona.

## Usuario objetivo

- **ICP-1** — dueño/a de una clínica de fisioterapia pequeña con la recepción saturada (heredado de `doc/app/app_market.md`).
- **ICP-2** — persona de recepción que atiende WhatsApp y email y revisa las respuestas.

## Alcance

### Incluye
- Subida, reemplazo y borrado de documentos de la clínica (PDF, DOCX, TXT y Markdown).
- Bandeja única con los mensajes de WhatsApp y email.
- Entrada de mensajes por webhooks con el formato de WhatsApp Cloud API y por un webhook de correo entrante.
- Simulador de mensajes dentro de la aplicación que usa la misma entrada que los webhooks.
- Borradores de respuesta redactados por Claude con citas a los documentos.
- Escalado a una persona cuando falta información, cuando es una consulta clínica o cuando falla la generación.
- Revisión, edición, aprobación y descarte de respuestas.
- Envío automático configurable para respuestas respaldadas y aviso de recepción para las escaladas.
- Registro de envíos **simulados** (la respuesta aprobada queda guardada como enviada y visible en el simulador).
- Acceso al panel protegido por contraseña de administración.
- Ejecución en local y despliegue en un único contenedor Docker en Coolify, con los datos en un volumen persistente.

### No incluye
- Envío real por WhatsApp Cloud API o por email (fase posterior; la interfaz de envío queda preparada).
- Varias clínicas en la misma instalación (una instalación = una clínica).
- Varios usuarios con roles distintos (hay una única cuenta de administración).
- Gestión de citas, agenda o CRM.
- Consejo clínico de cualquier tipo.
- Mensajes de voz, imágenes o adjuntos (se reciben y se marcan para revisión, pero no se interpretan).
- Analítica avanzada; solo contadores básicos en la bandeja.

---

## Decisiones tomadas en este PRD

El product owner pidió decidir sin más preguntas. Estas son las decisiones y su motivo:

| # | Decisión | Motivo |
|---|----------|--------|
| D1 | Una instalación sirve a una sola clínica | Encaja con «un solo contenedor en Coolify» y evita la complejidad de multi-cliente en v1 |
| D2 | Acceso con una contraseña de administración definida en el servidor | Protege el panel desplegado sin construir gestión de usuarios |
| D3 | Respuestas con la función de citas nativa de la API de Claude, enviando los documentos como bloques de documento | Las citas salen del propio modelo con el texto exacto citado, no de una reconstrucción posterior |
| D4 | Si el texto total de los documentos cabe en el contexto (≤ 150.000 tokens) se envía completo con caché de prompt; si no, se envía una selección por búsqueda de texto completo en SQLite | Una clínica pequeña tiene pocos documentos; enviarlos enteros maximiza la exactitud y la caché reduce coste |
| D5 | Modelo configurable (`ANTHROPIC_MODEL`), por defecto `claude-opus-5-5` con esfuerzo `medium` y reintento automático en otro modelo si un filtro de seguridad rechaza la petición | Es el modelo recomendado por defecto; bajar a uno más barato (p. ej. `claude-sonnet-5-5`) es una decisión de coste de la clínica, no del producto. Cambiado en la fase 4 (antes: `claude-sonnet-5-5`) |
| D6 | Doble control contra datos inventados: (a) el modelo debe declarar si la respuesta está respaldada; (b) la aplicación comprueba que cada precio, hora o cifra del borrador aparece en un fragmento citado | El riesgo principal del producto es dar un dato falso (JE-F1.1) |
| D7 | Las consultas clínicas se escalan siempre, aunque el envío automático esté activo | Principio anti-feature de `app_market.md` |
| D8 | El envío automático viene desactivado por defecto | La clínica decide cuándo confía; refuerza el control (JE-F1.3) |
| D9 | El correo entrante usa un JSON con remitente, asunto, cuerpo de texto e identificador de mensaje, compatible con el formato de correo entrante de Postmark | Formato documentado y extendido; sustituible por otro proveedor más adelante |
| D10 | Los webhooks responden en menos de 2 s y la redacción se hace en segundo plano | WhatsApp Cloud API reintenta si el webhook tarda; evita duplicados |

---

## Épicas

| Épica | Nombre | Objetivo | Historias |
|-------|--------|----------|-----------|
| EP-01 | Respuestas automáticas v1 | Contestar con datos de la clínica, citados y revisables, los mensajes de WhatsApp y email | US-01, US-02, US-03, US-04, US-05 |

## User Stories y Use Cases

### US-01: Documentos de la clínica · épica Respuestas automáticas v1 · satélite `app`

> Como dueño/a de la clínica, quiero subir y mantener al día mis documentos, para que las respuestas usen siempre mis datos reales.

#### UC-101: Subir documentos
- **Actor**: dueño/a o recepción (ICP-1, ICP-2)
- **Satélite**: app
- **Horas estimadas**: 6h
- **Pantallas**: Documentos

**Acceptance Criteria:**
- [ ] **AC-01** [JR-F1.1]: Dada la pantalla Documentos, cuando la persona sube un archivo PDF, DOCX, TXT o Markdown de hasta 10 MB, entonces el documento aparece en la lista con su nombre, categoría, fecha de subida y estado «Listo» en menos de 30 segundos.
- [ ] **AC-02** [JR-F1.1]: Cuando la persona intenta subir un archivo de otro formato o de más de 10 MB, entonces la subida se rechaza con un mensaje que indica el motivo y el archivo no aparece en la lista.
- [ ] **AC-03** [JR-F1.1]: Al subir un documento se elige una categoría (Tarifas, Horarios, Políticas, Preguntas frecuentes u Otros); la lista muestra la categoría y permite filtrar por ella.
- [ ] **AC-04** [JE-F1.1]: Si un PDF no contiene texto extraíble, el documento queda en estado «Sin texto», se muestra un aviso para subir una versión con texto y ese documento no se usa para redactar respuestas.

#### UC-102: Mantener los documentos al día
- **Actor**: dueño/a o recepción (ICP-1, ICP-2)
- **Satélite**: app
- **Horas estimadas**: 4h
- **Pantallas**: Documentos

**Acceptance Criteria:**
- [ ] **AC-05** [JR-F1.3]: Dado un documento de tarifas que indica «Sesión de fisioterapia: 40 €», cuando la persona lo reemplaza por una versión que indica «45 €», entonces el siguiente borrador que pregunte por el precio de la sesión dice 45 € y no menciona 40 €.
- [ ] **AC-06** [JR-F1.3]: Cuando la persona elimina un documento tras confirmar el aviso, el documento desaparece de la lista y ningún borrador generado después lo cita.

### US-02: Bandeja única de mensajes · épica Respuestas automáticas v1 · satélite `app`

> Como persona de recepción, quiero ver en un solo sitio los mensajes de WhatsApp y email, para no ir saltando entre aplicaciones.

#### UC-201: Recibir mensajes de WhatsApp por webhook
- **Actor**: sistema (WhatsApp Cloud API)
- **Satélite**: app
- **Horas estimadas**: 6h
- **Pantallas**: ninguna (entrada de datos)

**Acceptance Criteria:**
- [ ] **AC-07** [JR-F1.1]: Cuando llega la petición de verificación de WhatsApp Cloud API con el token de verificación configurado, el webhook responde con el valor de `hub.challenge`; con un token distinto responde con estado 403.
- [ ] **AC-08** [JR-F1.1]: Cuando llega un mensaje de texto con el formato de WhatsApp Cloud API, el webhook responde con estado 200 en menos de 2 segundos y el mensaje aparece en la bandeja con canal WhatsApp, número, nombre del contacto, texto y hora de recepción.
- [ ] **AC-09** [JR-F1.2]: Si el mismo mensaje (mismo identificador de WhatsApp) llega dos veces, la bandeja muestra una sola entrada.
- [ ] **AC-10** [JE-F1.1]: Si la instalación tiene activada la verificación de firma de WhatsApp y la firma de la petición no coincide, el webhook responde con estado 401 y no guarda el mensaje.
- [ ] **AC-11** [JR-F1.4]: Cuando llega un mensaje que no es de texto (imagen, audio, documento), aparece en la bandeja con la nota «Tipo de mensaje no soportado» y en estado «Requiere revisión».

#### UC-202: Recibir emails por webhook
- **Actor**: sistema (proveedor de correo entrante)
- **Satélite**: app
- **Horas estimadas**: 4h
- **Pantallas**: ninguna (entrada de datos)

**Acceptance Criteria:**
- [ ] **AC-12** [JR-F1.1]: Cuando llega un correo entrante con remitente, asunto, cuerpo de texto e identificador de mensaje, el webhook responde con estado 200 en menos de 2 segundos y el mensaje aparece en la bandeja con canal Email, remitente, asunto, texto y hora de recepción.
- [ ] **AC-13** [JE-F1.1]: Si la petición no incluye el token del webhook de correo configurado en el servidor, se responde con estado 401 y no se guarda nada; si llega dos veces el mismo identificador de mensaje, la bandeja muestra una sola entrada.

#### UC-203: Simular mensajes
- **Actor**: recepción o quien hace la demo (ICP-2)
- **Satélite**: app
- **Horas estimadas**: 5h
- **Pantallas**: Simulador

**Acceptance Criteria:**
- [ ] **AC-14** [JR-F1.1]: Dada la pantalla Simulador, cuando la persona elige canal (WhatsApp o Email), escribe un contacto y un texto y pulsa Enviar, entonces el mensaje entra por el mismo webhook que un mensaje real y aparece en la bandeja en menos de 5 segundos con la etiqueta «Simulado».
- [ ] **AC-15** [JR-F1.2]: El simulador muestra la conversación de cada contacto simulado con los mensajes enviados y las respuestas marcadas como enviadas, en orden cronológico, y se actualiza sin recargar la página en menos de 10 segundos.

#### UC-204: Consultar la bandeja
- **Actor**: recepción (ICP-2)
- **Satélite**: app
- **Horas estimadas**: 8h
- **Pantallas**: Bandeja, Detalle de mensaje

**Acceptance Criteria:**
- [ ] **AC-16** [JR-F1.1]: La bandeja lista los mensajes de ambos canales del más reciente al más antiguo; cada fila muestra el icono del canal, el contacto, los primeros 100 caracteres del texto, la hora y el estado (Nuevo, Borrador listo, Requiere revisión, Enviado, Descartado).
- [ ] **AC-17** [JR-F1.4]: La bandeja permite filtrar por canal y por estado, y muestra en todo momento el número de mensajes en «Requiere revisión».
- [ ] **AC-18** [JR-F1.5]: Al abrir un mensaje se ve su texto completo, el historial de mensajes y respuestas con ese contacto y el borrador propuesto con sus citas.
- [ ] **AC-19** [JE-F1.2]: Un mensaje nuevo aparece en la bandeja abierta sin recargar la página en menos de 10 segundos desde que llega.

### US-03: Borradores con citas · épica Respuestas automáticas v1 · satélite `app`

> Como persona de recepción, quiero que cada mensaje llegue con una respuesta preparada a partir de los documentos y con sus fuentes, para contestar en segundos sin buscar nada.

#### UC-301: Redactar el borrador citando los documentos
- **Actor**: sistema (Claude) para la recepción
- **Satélite**: app
- **Horas estimadas**: 10h
- **Pantallas**: Detalle de mensaje

**Acceptance Criteria:**
- [ ] **AC-20** [JR-F1.1]: Dado un documento de tarifas que indica «Sesión de fisioterapia: 40 €», cuando llega el mensaje «¿Cuánto cuesta una sesión?», entonces en menos de 15 segundos el mensaje pasa a «Borrador listo» con un borrador que contiene «40 €» y al menos una cita con el nombre del documento y un fragmento que contiene «40 €».
- [ ] **AC-21** [JE-F1.1]: Cada precio, hora, fecha o cifra que aparece en un borrador figura también en alguno de sus fragmentos citados; si no es así, el mensaje pasa a «Requiere revisión» con el motivo «Dato no encontrado en los documentos» y no se puede enviar automáticamente.
- [ ] **AC-22** [JR-F1.1]: El borrador se redacta en el idioma del mensaje recibido: un mensaje en inglés recibe un borrador en inglés y uno en español, un borrador en español.
- [ ] **AC-23** [JR-F1.5]: Al pulsar una cita del borrador se muestra el nombre del documento, su categoría y el fragmento completo citado, con el texto citado resaltado.

#### UC-302: Pasar a una persona lo que no está claro
- **Actor**: sistema para la recepción
- **Satélite**: app
- **Horas estimadas**: 6h
- **Pantallas**: Detalle de mensaje, Bandeja

**Acceptance Criteria:**
- [ ] **AC-24** [JR-F1.4]: Cuando llega una pregunta cuya respuesta no está en los documentos (por ejemplo «¿Tenéis parking?» sin ninguna mención a parking), el mensaje pasa a «Requiere revisión» con el motivo «No hay información en los documentos» y no se propone ninguna respuesta con datos.
- [ ] **AC-25** [JE-F1.3]: Cuando un mensaje describe síntomas o pide consejo clínico (por ejemplo «Me duele la rodilla, ¿qué ejercicios hago?»), el mensaje pasa a «Requiere revisión» con el motivo «Consulta clínica», también con el envío automático activado.
- [ ] **AC-26** [JR-F1.4]: Si la generación del borrador falla o no hay clave de Anthropic configurada, el mensaje pasa a «Requiere revisión» con el motivo «No se pudo generar el borrador» y un botón «Reintentar» que vuelve a lanzar la redacción.

### US-04: Revisión y envío · épica Respuestas automáticas v1 · satélite `app`

> Como persona de recepción, quiero decidir qué se envía y poder delegar lo que está respaldado, para tener el control sin escribirlo todo a mano.

#### UC-401: Revisar, editar y aprobar respuestas
- **Actor**: recepción (ICP-2)
- **Satélite**: app
- **Horas estimadas**: 6h
- **Pantallas**: Detalle de mensaje

**Acceptance Criteria:**
- [ ] **AC-27** [JR-F1.5]: Cuando la persona edita el borrador y pulsa «Aprobar y enviar», el mensaje pasa a «Enviado», el texto final aparece en el historial del contacto con la hora de envío y queda registrado en el registro de envíos con canal, destinatario y texto.
- [ ] **AC-28** [JE-F1.3]: En un mensaje en «Requiere revisión» la persona puede escribir la respuesta desde cero y enviarla; el envío queda registrado igual que en AC-27.
- [ ] **AC-29** [JR-F1.5]: La persona puede descartar un mensaje sin responder (pasa a «Descartado») y reabrirlo después (vuelve a su estado anterior).
- [ ] **AC-30** [JE-F1.3]: Cada respuesta enviada queda marcada como «Aprobada sin cambios», «Editada» o «Escrita a mano», y la bandeja muestra el porcentaje de respuestas aprobadas sin cambios de los últimos 7 días.

#### UC-402: Activar el envío automático
- **Actor**: dueño/a de la clínica (ICP-1)
- **Satélite**: app
- **Horas estimadas**: 5h
- **Pantallas**: Ajustes

**Acceptance Criteria:**
- [ ] **AC-31** [JR-F1.2]: El envío automático está desactivado en una instalación nueva; al activarlo, cada borrador respaldado por los documentos y sin motivo de revisión se envía en menos de 30 segundos desde la recepción y queda marcado como «Enviado automáticamente».
- [ ] **AC-32** [JE-F1.2]: Con el envío automático activado, un mensaje en «Requiere revisión» no recibe respuesta automática con datos; en su lugar el contacto recibe una sola vez el aviso de recepción configurable (por defecto: «Hemos recibido tu mensaje. Una persona del equipo te responderá lo antes posible.»).
- [ ] **AC-33** [JE-F1.3]: Al desactivar el envío automático, el siguiente mensaje que llega queda en «Borrador listo» o «Requiere revisión» y no se envía nada sin aprobación.

### US-05: Acceso y despliegue · épica Respuestas automáticas v1 · satélite `app`

> Como dueño/a de la clínica, quiero que el panel esté protegido y que la aplicación se instale con un solo contenedor, para usarla con tranquilidad en mi servidor.

#### UC-501: Proteger el acceso al panel
- **Actor**: dueño/a o recepción (ICP-1, ICP-2)
- **Satélite**: app
- **Horas estimadas**: 3h
- **Pantallas**: Inicio de sesión

**Acceptance Criteria:**
- [ ] **AC-34** [JE-F1.1]: Sin sesión iniciada, cualquier pantalla del panel redirige al inicio de sesión y cualquier operación de la aplicación responde con estado 401, salvo los webhooks y la comprobación de estado.
- [ ] **AC-35** [JE-F1.1]: Con la clave de acceso de administración definida en el servidor se inicia una sesión válida durante 7 días; con una clave incorrecta se muestra un error, y tras 5 intentos fallidos en un minuto hay que esperar 60 segundos para volver a intentarlo.

#### UC-502: Ejecutar en local y desplegar en un contenedor
- **Actor**: quien instala la aplicación
- **Satélite**: app
- **Horas estimadas**: 4h
- **Pantallas**: ninguna

**Acceptance Criteria:**
- [ ] **AC-36** [JR-F1.1]: Siguiendo el README, la aplicación arranca en local en el puerto 3000 con un único comando y crea su base de datos vacía automáticamente en el primer arranque.
- [ ] **AC-37** [JR-F1.3]: La imagen Docker arranca un único contenedor que expone el puerto 3000; un documento subido y un mensaje recibido siguen disponibles después de reiniciar el contenedor con el mismo volumen de datos.
- [ ] **AC-38** [JR-F1.2]: La comprobación de estado responde con estado 200 y `{"status":"ok"}` cuando la base de datos está accesible, y con estado 503 cuando no lo está, de modo que Coolify puede usarla para vigilar el contenedor.

---

## Interacciones UI

> Esta sección alimenta el análisis de componentes en /plan

### Visualización de datos
| Dato | Volumen | Atributos visibles | Acciones por item |
|------|---------|-------------------|-------------------|
| Mensajes en bandeja | 20-500 al día | canal, contacto, extracto, hora, estado | abrir, filtrar |
| Historial de un contacto | 1-50 mensajes | dirección (entrante/saliente), texto, hora, tipo de envío | leer |
| Documentos | 5-50 | nombre, categoría, fecha, estado | reemplazar, eliminar, filtrar |
| Citas de un borrador | 1-5 | documento, categoría, fragmento resaltado | abrir |
| Conversaciones simuladas | 1-10 contactos | contacto, canal, mensajes | enviar mensaje |

### Acciones del usuario
| Acción | UC asociado | Frecuencia | Criticidad | Requiere confirmación |
|--------|-------------|------------|------------|----------------------|
| Subir documento | UC-101 | Ocasional | Baja | No |
| Reemplazar documento | UC-102 | Ocasional | Media | No |
| Eliminar documento | UC-102 | Rara | Alta (afecta a respuestas) | Sí |
| Enviar mensaje simulado | UC-203 | Frecuente en demo | Baja | No |
| Filtrar bandeja | UC-204 | Diaria | Baja | No |
| Abrir cita | UC-301 | Diaria | Baja | No |
| Reintentar borrador | UC-302 | Rara | Baja | No |
| Aprobar y enviar | UC-401 | Diaria, muchas veces | Alta (irreversible: llega al paciente) | No (el botón dice exactamente lo que hace) |
| Escribir respuesta a mano | UC-401 | Diaria | Alta | No |
| Descartar / reabrir | UC-401 | Ocasional | Baja (reversible) | No |
| Activar envío automático | UC-402 | Rara | Alta | Sí |
| Editar aviso de recepción | UC-402 | Rara | Media | No |
| Iniciar sesión | UC-501 | Diaria | Baja | No |

### Selecciones/Filtros
| Filtro | Opciones | Selección | Frecuencia |
|--------|----------|-----------|------------|
| Canal (bandeja) | Todos, WhatsApp, Email | Única | Frecuente |
| Estado (bandeja) | Todos, Nuevo, Borrador listo, Requiere revisión, Enviado, Descartado | Única | Frecuente |
| Categoría (documentos) | Todas, Tarifas, Horarios, Políticas, Preguntas frecuentes, Otros | Única | Ocasional |
| Canal (simulador) | WhatsApp, Email | Única | Frecuente en demo |

### Formularios
| Formulario | UC asociado | Campos | Contexto |
|------------|-------------|--------|----------|
| Subir documento | UC-101 | 2 (archivo, categoría) | Panel lateral en Documentos |
| Mensaje simulado | UC-203 | 4 (canal, contacto, asunto si email, texto) | Pantalla Simulador |
| Respuesta | UC-401 | 1 (texto) | Detalle de mensaje |
| Ajustes | UC-402 | 3 (envío automático, aviso de recepción, nombre de la clínica) | Pantalla Ajustes |
| Inicio de sesión | UC-501 | 1 (contraseña) | Pantalla completa |

---

## Audiencia (alimenta VEG)

### Targets de la aplicación
Clínicas de fisioterapia pequeñas y la persona que atiende a sus pacientes. Ambos targets comparten la misma interfaz; el uso diario lo hace recepción.

### Target 1: Dueño/a de la clínica (ICP-1)
- **Perfil**: gerente de una clínica de 1 a 5 fisioterapeutas; nivel técnico básico.
- **Contexto de uso**: ocasional, desde el ordenador de la clínica o el móvil; sube documentos y decide el envío automático.
- **JTBD Racional**: JR-F1.1, JR-F1.2, JR-F1.3 (ver discovery).
- **JTBD Emocional**: JE-F1.1 tranquilidad, JE-F1.2 alivio.
- **Referentes**: WhatsApp Business, Gmail, su agenda online.
- **Expectativa visual**: sencilla, clara y fiable; nada de jerga técnica.

### Target 2: Persona de recepción (ICP-2)
- **Perfil**: recepcionista o administrativo/a; trabaja con interrupciones constantes.
- **Contexto de uso**: diario y continuo, en el ordenador de recepción, a ratos entre pacientes.
- **JTBD Racional**: JR-F1.4, JR-F1.5.
- **JTBD Emocional**: JE-F1.3 control.
- **Referentes**: WhatsApp Web, bandejas de correo.
- **Expectativa visual**: bandeja tipo correo, estados con color y texto, acciones principales siempre visibles.

**Modo VEG:** uniforme (los dos targets comparten interfaz y tono).

---

## Requisitos No Funcionales (NFRs)

| NFR | Criterio | Medición |
|-----|----------|----------|
| Rendimiento — webhooks | Respuesta < 2 s en el 99 % de las peticiones | Test de integración con cronómetro |
| Rendimiento — borrador | Borrador listo < 15 s en el 95 % de los mensajes con ≤ 50 documentos | Registro de tiempos por mensaje |
| Rendimiento — bandeja | Carga inicial < 2 s con 1.000 mensajes | Test E2E con base de datos sembrada |
| Exactitud | 0 respuestas enviadas con cifras que no aparezcan en los fragmentos citados | Verificación automática de AC-21 en cada borrador |
| Seguridad | Clave de Anthropic y secretos solo en variables de entorno; nunca en el repositorio ni en la interfaz | Revisión de repositorio y de respuestas de la aplicación |
| Seguridad | Webhooks con verificación de firma (WhatsApp) y token (correo) | Tests AC-10 y AC-13 |
| Privacidad | A Claude solo se envían el mensaje del cliente, el historial reciente de ese contacto (máx. 10 mensajes) y los documentos; los datos se quedan en el volumen del contenedor | Revisión del código de redacción |
| Disponibilidad | Reinicio del contenedor sin pérdida de datos | Test AC-37 |
| Accesibilidad | WCAG 2.1 AA en Bandeja, Detalle y Documentos; estados con texto, no solo color | Auditoría axe-core en E2E |
| Idioma | Interfaz en español; respuestas en el idioma del mensaje | Test AC-22 |

---

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Claude afirma un dato que no está en los documentos | Media | Alto | D3 + D6: citas nativas, declaración de respaldo y comprobación automática de cifras; en duda, a revisión |
| Preguntas formuladas con palabras distintas a las del documento («precio» vs «tarifa») | Media | Medio | D4: documentos completos en el contexto mientras quepan |
| PDF escaneados sin texto | Media | Medio | AC-04: estado «Sin texto» y aviso |
| Caída o lentitud de la API de Anthropic | Baja | Medio | AC-26: escalado con «Reintentar»; la bandeja sigue funcionando |
| Cambios en el formato de WhatsApp Cloud API | Baja | Medio | Validación del payload con esquema y tests con ejemplos oficiales |
| Datos personales de pacientes (RGPD) | Media | Alto | Datos en el servidor de la clínica; mínimo envío a Claude; aviso en README sobre encargado de tratamiento |
| Al pasar al envío real, la ventana de 24 h de WhatsApp limita respuestas tardías | Alta (fase 2) | Medio | Fuera de alcance v1; el registro de envíos ya guarda la hora del último mensaje del cliente |
| Escrituras concurrentes en SQLite | Baja | Bajo | Modo WAL y un único proceso de aplicación |

---

## Stack Técnico (estimado)

- **App**: Next.js (App Router) con TypeScript; un único proceso que sirve panel, API y webhooks.
- **Base de datos**: SQLite (`better-sqlite3`) en modo WAL, con FTS5 para la búsqueda de texto completo; fichero en el volumen `/data`.
- **Documentos**: extracción de texto de PDF y DOCX en el servidor; troceado en fragmentos con referencia al documento y posición.
- **IA**: SDK oficial de Anthropic para TypeScript; documentos como bloques con citas activadas; caché de prompt; modelo por variable de entorno.
- **Trabajo en segundo plano**: cola en SQLite procesada dentro del mismo proceso (sin servicios extra).
- **UI**: React con Tailwind CSS; actualización de la bandeja por consulta periódica cada 5 s.
- **Tests**: Vitest (unitarios e integración) y Playwright (E2E).
- **Contenedor**: imagen multi-etapa con salida `standalone` de Next.js; volumen `/data`; puerto 3000; comprobación de estado para Coolify.
- **Configuración** (variables de entorno): `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (opcional), `EMAIL_WEBHOOK_TOKEN`, `DATA_DIR`.

### Pantallas
Inicio de sesión · Bandeja · Detalle de mensaje · Documentos · Simulador · Ajustes

## Archivos principales (estimado)

```
app/
  (panel)/bandeja/            # Bandeja y detalle de mensaje
  (panel)/documentos/
  (panel)/simulador/
  (panel)/ajustes/
  login/
  api/webhooks/whatsapp/      # GET verificación + POST mensajes
  api/webhooks/email/
  api/health/
  api/...                     # operaciones del panel
lib/
  db/                         # esquema SQLite, migraciones, FTS5
  documents/                  # extracción, troceado, indexado
  drafting/                   # llamada a Claude, citas, comprobación de cifras, escalado
  inbox/                      # normalización de WhatsApp y email a un mensaje común
  sending/                    # interfaz de envío (implementación simulada en v1)
  auth/
Dockerfile
```

## Dependencias
- Clave de API de Anthropic (ya preparada en `.env`, fuera del repositorio).
- Para pruebas con WhatsApp real (opcional en v1): app de Meta con WhatsApp Cloud API apuntando al webhook público.

---

## Criterios de Aceptación (consolidado)

### Funcionales
- [ ] **AC-01** — UC-101 · Subida de PDF/DOCX/TXT/MD ≤ 10 MB lista en < 30 s
- [ ] **AC-02** — UC-101 · Rechazo de formato o tamaño no válido con motivo
- [ ] **AC-03** — UC-101 · Categoría al subir y filtro por categoría
- [ ] **AC-04** — UC-101 · PDF sin texto en estado «Sin texto» y excluido
- [ ] **AC-05** — UC-102 · Reemplazo de documento: el siguiente borrador usa el dato nuevo
- [ ] **AC-06** — UC-102 · Documento eliminado deja de citarse
- [ ] **AC-07** — UC-201 · Verificación del webhook de WhatsApp
- [ ] **AC-08** — UC-201 · Mensaje de texto de WhatsApp en la bandeja, respuesta < 2 s
- [ ] **AC-09** — UC-201 · Mensajes duplicados de WhatsApp en una sola entrada
- [ ] **AC-10** — UC-201 · Firma no válida rechazada con 401
- [ ] **AC-11** — UC-201 · Mensajes no textuales a revisión
- [ ] **AC-12** — UC-202 · Email entrante en la bandeja, respuesta < 2 s
- [ ] **AC-13** — UC-202 · Token de correo obligatorio y deduplicación
- [ ] **AC-14** — UC-203 · Simulador por la misma entrada que los webhooks, etiqueta «Simulado»
- [ ] **AC-15** — UC-203 · Conversación simulada actualizada en < 10 s
- [ ] **AC-16** — UC-204 · Listado unificado con canal, contacto, extracto, hora y estado
- [ ] **AC-17** — UC-204 · Filtros y contador de «Requiere revisión»
- [ ] **AC-18** — UC-204 · Detalle con historial y borrador con citas
- [ ] **AC-19** — UC-204 · Mensajes nuevos visibles sin recargar en < 10 s
- [ ] **AC-20** — UC-301 · Borrador con «40 €» y cita en < 15 s
- [ ] **AC-21** — UC-301 · Toda cifra del borrador está en un fragmento citado; si no, a revisión
- [ ] **AC-22** — UC-301 · Borrador en el idioma del mensaje
- [ ] **AC-23** — UC-301 · Cita abre documento, categoría y fragmento resaltado
- [ ] **AC-24** — UC-302 · Sin información en documentos → revisión sin datos inventados
- [ ] **AC-25** — UC-302 · Consulta clínica → revisión siempre
- [ ] **AC-26** — UC-302 · Fallo de generación → revisión con «Reintentar»
- [ ] **AC-27** — UC-401 · Editar, aprobar y registrar envío
- [ ] **AC-28** — UC-401 · Respuesta escrita a mano en mensajes escalados
- [ ] **AC-29** — UC-401 · Descartar y reabrir
- [ ] **AC-30** — UC-401 · Marca de tipo de respuesta y % aprobadas sin cambios en 7 días
- [ ] **AC-31** — UC-402 · Envío automático desactivado por defecto; si se activa, envío < 30 s
- [ ] **AC-32** — UC-402 · Aviso de recepción único para mensajes escalados
- [ ] **AC-33** — UC-402 · Desactivar el envío automático detiene envíos sin aprobación
- [ ] **AC-34** — UC-501 · Panel y operaciones protegidos salvo webhooks y estado
- [ ] **AC-35** — UC-501 · Sesión de 7 días y bloqueo tras 5 intentos fallidos por minuto
- [ ] **AC-36** — UC-502 · Arranque local con un comando y base de datos automática
- [ ] **AC-37** — UC-502 · Contenedor único con datos persistentes tras reinicio
- [ ] **AC-38** — UC-502 · Comprobación de estado 200/503 para Coolify

### Técnicos (no validados por AG-09)
- [ ] Proyecto compila sin errores
- [ ] Tests con 85 %+ de cobertura en `lib/`
- [ ] Lint sin errores

---
**Prioridad**: high
**Complejidad**: Media
*Generado: 2026-10-23*
