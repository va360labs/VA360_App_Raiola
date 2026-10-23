/** Pure constants shared by the server and the browser. */
export type MessageStatus = "new" | "drafting" | "draft_ready" | "needs_review" | "sent" | "discarded";

export const STATUS_LABELS: Record<MessageStatus, string> = {
  new: "Nuevo",
  drafting: "Nuevo",
  draft_ready: "Borrador listo",
  needs_review: "Requiere revisión",
  sent: "Enviado",
  discarded: "Descartado",
};

export const CHANNEL_LABELS = { whatsapp: "WhatsApp", email: "Email" } as const;

export const SEND_MODE_LABELS = {
  approved: "Aprobada sin cambios",
  edited: "Editada",
  manual: "Escrita a mano",
  auto: "Enviada automáticamente",
  ack: "Aviso de recepción",
} as const;

/** «Enviado» or «Enviado automáticamente», otherwise the plain status label. */
export function inboxStatusLabel(status: MessageStatus, sendMode: string | null): string {
  if (status === "sent" && sendMode === "auto") return "Enviado automáticamente";
  return STATUS_LABELS[status];
}
