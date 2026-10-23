import type { Category } from "@/lib/documents/categories";

/** A piece of clinic knowledge given to the model; one per document (or per fragment when they do not fit). */
export interface Source {
  documentId: number;
  name: string;
  category: Category;
  text: string;
}

export interface HistoryEntry {
  from: "patient" | "clinic";
  text: string;
}

export interface DraftRequest {
  sources: Source[];
  history: HistoryEntry[];
  message: { channel: "whatsapp" | "email"; subject: string | null; body: string };
  clinicName: string;
}

export interface Citation {
  documentId: number;
  documentName: string;
  category: Category;
  citedText: string;
  /** Position of the cited text inside the source given to the model. */
  start: number;
  end: number;
}

/**
 * What the model answered. `escalation` is set when the model itself says the
 * question is not covered by the documents or is a clinical question.
 */
export interface DraftResult {
  text: string;
  citations: Citation[];
  escalation: "no_information" | "clinical" | null;
  refused: boolean;
  model: string;
}

export interface DraftModel {
  readonly name: string;
  draft(request: DraftRequest): Promise<DraftResult>;
}

export class DraftModelUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftModelUnavailableError";
  }
}

export const NO_INFORMATION_MARKER = "[[SIN_INFORMACION]]";
export const CLINICAL_MARKER = "[[CONSULTA_CLINICA]]";
