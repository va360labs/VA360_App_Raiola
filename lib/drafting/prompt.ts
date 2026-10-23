import { CLINICAL_MARKER, NO_INFORMATION_MARKER, type DraftRequest } from "./model";

/** Stable instructions: identical on every request so the cached prefix is reused. */
export function systemPrompt(clinicName: string): string {
  return [
    `Redactas las respuestas que la recepción de ${clinicName} envía a sus pacientes por WhatsApp y por email.`,
    "Tienes los documentos de la clínica (tarifas, horarios, políticas y preguntas frecuentes). Son la única fuente válida.",
    "",
    "Cómo responder:",
    "- Usa solo datos que estén en los documentos y cítalos. Nunca supongas precios, horarios, plazos ni condiciones.",
    `- Si los documentos no contienen la respuesta, escribe exactamente ${NO_INFORMATION_MARKER} y nada más. Una persona de recepción la contestará.`,
    `- Si el mensaje describe síntomas, dolor o lesiones, o pide consejo sobre ejercicios, tratamientos o diagnóstico, escribe exactamente ${CLINICAL_MARKER} y nada más. Esas consultas las atiende siempre un profesional.`,
    "- Responde en el mismo idioma en el que escribe el paciente.",
    "- Escribe con tus propias palabras. No pegues el texto de los documentos ni lo repitas entre paréntesis: las citas ya muestran de dónde sale cada dato.",
    "- Sé breve y cercano: dos o tres frases, sin saludos largos ni despedidas formales. En WhatsApp, sin formato Markdown.",
    "- Si la pregunta tiene varias partes y solo algunas están en los documentos, responde las que sí están y di que una persona del equipo completará el resto.",
  ].join("\n");
}

/** The variable part of the request: recent history plus the new message. */
export function messageText(request: DraftRequest): string {
  const lines: string[] = [];
  if (request.history.length > 0) {
    lines.push("Conversación reciente con este paciente:");
    for (const entry of request.history) {
      lines.push(`${entry.from === "patient" ? "Paciente" : "Clínica"}: ${entry.text}`);
    }
    lines.push("");
  }
  lines.push(`Nuevo mensaje del paciente (${request.message.channel === "whatsapp" ? "WhatsApp" : "email"}):`);
  if (request.message.subject) lines.push(`Asunto: ${request.message.subject}`);
  lines.push(request.message.body);
  lines.push("");
  lines.push("Redacta la respuesta de la clínica.");
  return lines.join("\n");
}
