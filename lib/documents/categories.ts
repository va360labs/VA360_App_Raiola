/** Pure constants shared by the server and the browser (no Node imports here). */
export const CATEGORIES = {
  tarifas: "Tarifas",
  horarios: "Horarios",
  politicas: "Políticas",
  faq: "Preguntas frecuentes",
  otros: "Otros",
} as const;

export type Category = keyof typeof CATEGORIES;
export type DocumentStatus = "processing" | "ready" | "no_text" | "error";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && Object.hasOwn(CATEGORIES, value);
}
