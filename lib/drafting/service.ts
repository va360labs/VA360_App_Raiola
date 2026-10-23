import { getDb } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs";
import { getSetting } from "@/lib/settings";
import { unsupportedFigures } from "./figures";
import { AnthropicDraftModel } from "./anthropic";
import { FakeDraftModel } from "./fake";
import type { Citation, DraftModel, HistoryEntry } from "./model";
import { selectSources } from "./sources";

export const REASONS = {
  noInformation: "No hay información en los documentos",
  clinical: "Consulta clínica",
  unsupportedFigure: "Dato no encontrado en los documentos",
  failed: "No se pudo generar el borrador",
} as const;

export const HISTORY_LIMIT = 10;

/** The model used for drafting: Claude by default, a deterministic fake with DRAFT_MODEL=fake. */
export function createDraftModel(): DraftModel {
  return process.env.DRAFT_MODEL === "fake" ? new FakeDraftModel() : new AnthropicDraftModel();
}

interface MessageRow {
  id: number;
  contact_id: number;
  channel: "whatsapp" | "email";
  subject: string | null;
  body: string;
  status: string;
  received_at: string;
}

/** Up to HISTORY_LIMIT earlier messages and replies with this contact, oldest first. */
function history(message: MessageRow): HistoryEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT at, from_, text FROM (
         SELECT received_at AS at, 'patient' AS from_, body AS text FROM messages
          WHERE contact_id = @contact AND direction = 'in' AND id != @id AND received_at <= @at AND body != ''
         UNION ALL
         SELECT sent_at AS at, 'clinic' AS from_, text FROM outbox WHERE contact_id = @contact AND sent_at <= @at
       ) ORDER BY at DESC LIMIT @limit`,
    )
    .all({ contact: message.contact_id, id: message.id, at: message.received_at, limit: HISTORY_LIMIT }) as {
    from_: "patient" | "clinic";
    text: string;
  }[];
  return rows.reverse().map((r) => ({ from: r.from_, text: r.text }));
}

interface Outcome {
  status: "draft_ready" | "needs_review";
  reason: string | null;
  text: string;
  citations: Citation[];
  model: string | null;
}

function saveOutcome(messageId: number, outcome: Outcome, latencyMs: number) {
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO drafts (message_id, text, citations, grounded, reason, model, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      messageId,
      outcome.text,
      JSON.stringify(outcome.citations),
      outcome.status === "draft_ready" ? 1 : 0,
      outcome.reason,
      outcome.model,
      latencyMs,
    );
    db.prepare("UPDATE messages SET status = ?, review_reason = ? WHERE id = ?").run(outcome.status, outcome.reason, messageId);
  })();
}

/**
 * Drafts the answer to one message. The draft is ready only when the model
 * answered from the documents, cited them, and every figure it wrote appears
 * in the cited text; anything else goes to a person with the reason.
 */
export async function draftMessage(messageId: number, model?: DraftModel): Promise<Outcome | null> {
  const db = getDb();
  const message = db
    .prepare("SELECT id, contact_id, channel, subject, body, status, received_at FROM messages WHERE id = ?")
    .get(messageId) as MessageRow | undefined;
  if (!message || (message.status !== "new" && message.status !== "drafting")) return null;
  db.prepare("UPDATE messages SET status = 'drafting' WHERE id = ?").run(messageId);

  const started = Date.now();
  let outcome: Outcome;
  try {
    const drafter = model ?? createDraftModel();
    const sources = selectSources(`${message.subject ?? ""} ${message.body}`);
    if (sources.length === 0) {
      outcome = { status: "needs_review", reason: REASONS.noInformation, text: "", citations: [], model: null };
    } else {
      const result = await drafter.draft({
        sources,
        history: history(message),
        message: { channel: message.channel, subject: message.subject, body: message.body },
        clinicName: getSetting("clinic_name").trim() || "la clínica",
      });
      const base = { text: result.text, citations: result.citations, model: result.model };
      if (result.refused) outcome = { ...base, status: "needs_review", reason: REASONS.failed };
      else if (result.escalation === "clinical") outcome = { ...base, status: "needs_review", reason: REASONS.clinical };
      else if (result.escalation === "no_information" || result.citations.length === 0 || !result.text)
        outcome = { ...base, status: "needs_review", reason: REASONS.noInformation };
      else if (unsupportedFigures(result.text, result.citations.map((c) => c.citedText)).length > 0)
        outcome = { ...base, status: "needs_review", reason: REASONS.unsupportedFigure };
      else outcome = { ...base, status: "draft_ready", reason: null };
    }
  } catch {
    outcome = { status: "needs_review", reason: REASONS.failed, text: "", citations: [], model: null };
  }

  saveOutcome(messageId, outcome, Date.now() - started);
  return outcome;
}

export type RetryResult = "queued" | "not_found" | "not_retryable";

/** Sends a message whose draft failed back to the drafting queue. */
export function retryDraft(messageId: number): RetryResult {
  const db = getDb();
  const row = db.prepare("SELECT status, review_reason FROM messages WHERE id = ?").get(messageId) as
    | { status: string; review_reason: string | null }
    | undefined;
  if (!row) return "not_found";
  if (row.status !== "needs_review" || row.review_reason !== REASONS.failed) return "not_retryable";
  db.prepare("UPDATE messages SET status = 'new', review_reason = NULL WHERE id = ?").run(messageId);
  enqueueJob("draft", { messageId });
  return "queued";
}

export interface StoredDraft {
  text: string;
  citations: Citation[];
  grounded: boolean;
  reason: string | null;
  model: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export function latestDraft(messageId: number): StoredDraft | null {
  const row = getDb()
    .prepare(
      "SELECT text, citations, grounded, reason, model, latency_ms, created_at FROM drafts WHERE message_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(messageId) as
    | { text: string; citations: string; grounded: number; reason: string | null; model: string | null; latency_ms: number | null; created_at: string }
    | undefined;
  if (!row) return null;
  return {
    text: row.text,
    citations: JSON.parse(row.citations) as Citation[],
    grounded: row.grounded === 1,
    reason: row.reason,
    model: row.model,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
  };
}
