# Aceptación — respuestas-automaticas

> Generado: 2026-10-23T18:50:22.282Z · Rama: feature/respuestas-automaticas
> Playwright contra el build de producción, carpeta de datos nueva, modelo de pruebas determinista (`DRAFT_MODEL=fake`).

**Resultado: 38/38 criterios PASS** · 44 tests de Playwright (44 en verde) · accesibilidad axe WCAG 2.1 AA: 5/5 pantallas sin violaciones.

| AC | UC | Estado | Evidencia |
|----|----|--------|-----------|
| AC-01 | UC-101 | PASS | us01-documentos.spec.ts: «un TXT de hasta 10 MB aparece en la lista como «Listo» en menos de 30 segundos» |
| AC-02 | UC-101 | PASS | us01-documentos.spec.ts: «un archivo de otro formato se rechaza con el motivo y no aparece»<br>us01-documentos.spec.ts: «un archivo de más de 10 MB se rechaza» |
| AC-03 | UC-101 | PASS | us01-documentos.spec.ts: «la categoría se elige al subir y la lista se filtra por ella» |
| AC-04 | UC-101 | PASS | us01-documentos.spec.ts: «un PDF sin texto queda «Sin texto», con aviso, y no se usa» |
| AC-05 | UC-102 | PASS | us01-documentos.spec.ts: «tras reemplazar 40 € por 45 €, el siguiente borrador dice 45 € y no 40 €» |
| AC-06 | UC-102 | PASS | us01-documentos.spec.ts: «un documento eliminado tras confirmar deja de aparecer y no se cita» |
| AC-07 | UC-201 | PASS | us02-bandeja.spec.ts: «la verificación de Meta devuelve el challenge con el token correcto y 403 si no» |
| AC-08 | UC-201 | PASS | us02-bandeja.spec.ts: «un mensaje de texto responde 200 en menos de 2 s y aparece en la bandeja» |
| AC-09 | UC-201 | PASS | us02-bandeja.spec.ts: «el mismo mensaje dos veces deja una sola entrada» |
| AC-10 | UC-201 | PASS | us02-bandeja.spec.ts: «con la verificación de firma activa, una firma que no coincide da 401 y no se guarda» |
| AC-11 | UC-201 | PASS | us02-bandeja.spec.ts: «un mensaje que no es de texto aparece como «Tipo de mensaje no soportado» en revisión» |
| AC-12 | UC-202 | PASS | us02-bandeja.spec.ts: «un correo entrante responde 200 en menos de 2 s y aparece con remitente y asunto» |
| AC-13 | UC-202 | PASS | us02-bandeja.spec.ts: «sin token se responde 401 y no se guarda; el mismo identificador dos veces deja una entrada» |
| AC-14 | UC-203 | PASS | us02-bandeja.spec.ts: «el simulador envía por el mismo webhook y el mensaje aparece con «Simulado» en menos de 5 s» |
| AC-15 | UC-203 | PASS | us02-bandeja.spec.ts: «la conversación simulada muestra mensajes y respuestas en orden y se actualiza sin recargar» |
| AC-16 | UC-204 | PASS | us02-bandeja.spec.ts: «la bandeja lista ambos canales del más reciente al más antiguo con canal, contacto, extracto, hora y estado» |
| AC-17 | UC-204 | PASS | us02-bandeja.spec.ts: «la bandeja filtra por canal y estado y muestra cuántos mensajes requieren revisión» |
| AC-18 | UC-204 | PASS | us02-bandeja.spec.ts: «al abrir un mensaje se ve el texto completo, el historial y el borrador con sus citas» |
| AC-19 | UC-204 | PASS | us02-bandeja.spec.ts: «un mensaje nuevo aparece en la bandeja abierta sin recargar en menos de 10 s» |
| AC-20 | UC-301 | PASS | us03-borradores.spec.ts: ««¿Cuánto cuesta una sesión?» queda en «Borrador listo» en menos de 15 s con 40 € y una cita a las tarifas» |
| AC-21 | UC-301 | PASS | us03-borradores.spec.ts: «una cifra que no está en los fragmentos citados manda el mensaje a revisión» |
| AC-22 | UC-301 | PASS | us03-borradores.spec.ts: «el borrador se redacta en el idioma del mensaje» |
| AC-23 | UC-301 | PASS | us03-borradores.spec.ts: «al pulsar una cita se ve el documento, su categoría y el fragmento con el texto citado resaltado» |
| AC-24 | UC-302 | PASS | us03-borradores.spec.ts: «una pregunta sin respuesta en los documentos va a revisión sin datos» |
| AC-25 | UC-302 | PASS | us03-borradores.spec.ts: «una consulta clínica va a revisión como «Consulta clínica», también con el envío automático activado» |
| AC-26 | UC-302 | PASS | us03-borradores.spec.ts: «si falla la generación, el mensaje pasa a revisión con «Reintentar», que vuelve a lanzarla» |
| AC-27 | UC-401 | PASS | us04-revision.spec.ts: «al editar y aprobar, el mensaje pasa a «Enviado» y la respuesta queda registrada» |
| AC-28 | UC-401 | PASS | us04-revision.spec.ts: «en un mensaje en revisión se puede escribir la respuesta desde cero y enviarla» |
| AC-29 | UC-401 | PASS | us04-revision.spec.ts: «se puede descartar sin responder y reabrir después al estado anterior» |
| AC-30 | UC-401 | PASS | us04-revision.spec.ts: «cada respuesta queda marcada y la bandeja muestra el % aprobadas sin cambios en 7 días» |
| AC-31 | UC-402 | PASS | us04-revision.spec.ts: «desactivado al empezar; al activarlo, un borrador respaldado se envía solo en menos de 30 s» |
| AC-32 | UC-402 | PASS | us04-revision.spec.ts: «con el envío automático, un mensaje en revisión recibe una sola vez el aviso de recepción» |
| AC-33 | UC-402 | PASS | us04-revision.spec.ts: «al desactivarlo, el siguiente mensaje queda pendiente de aprobación» |
| AC-34 | UC-501 | PASS | us05-acceso.spec.ts: «sin sesión, las pantallas llevan al inicio de sesión y la API responde 401, salvo webhooks y estado» |
| AC-35 | UC-501 | PASS | us05-acceso.spec.ts: «con la clave correcta se entra con una sesión de 7 días; con una incorrecta se ve un error»<br>us05-acceso.spec.ts: «tras 5 intentos fallidos en un minuto hay que esperar 60 segundos» |
| AC-36 | UC-502 | PASS | setup.ts: «arranca con una base de datos vacía creada en el primer arranque» |
| AC-37 | UC-502 | PASS | Contenedor Docker: subida de TXT, PDF y DOCX, mensaje recibido, `docker restart` con el mismo volumen y datos intactos; HEALTHCHECK `healthy` |
| AC-38 | UC-502 | PASS | us05-acceso.spec.ts: «la comprobación de estado responde 200 con status ok»<br>503 cubierto por los tests de integración (base de datos inaccesible) |

## Accesibilidad (axe-core, WCAG 2.1 A/AA)

- Bandeja con un mensaje abierto: sin violaciones
- Pantalla /documentos: sin violaciones
- Pantalla /simulador: sin violaciones
- Pantalla /ajustes: sin violaciones
- Pantalla /login: sin violaciones

## Prueba real con Claude (fase 4)

6 mensajes con `claude-opus-5-5`: 4 borradores citados por línea (1,9–3,9 s), «¿Tenéis parking?» a revisión por falta de información y la consulta de la rodilla como consulta clínica.
