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
