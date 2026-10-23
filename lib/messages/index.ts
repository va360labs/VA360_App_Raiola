import { getDb } from "@/lib/db";
import { getDocument } from "@/lib/documents";
import { latestDraft, type StoredDraft } from "@/lib/drafting/service";
import type { Citation } from "@/lib/drafting/model";
import type { Channel } from "@/lib/inbox/types";
import { defaultSender, type SendMode, type Sender } from "@/lib/sending/sender";
import type { MessageStatus } from "./status";

/** Statuses as the inbox shows them: a message being drafted still reads as «Nuevo». */
export type InboxStatus = "new" | "draft_ready" | "needs_review" | "sent" | "discarded";

export const INBOX_STATUSES: InboxStatus[] = ["new", "draft_ready", "needs_review", "sent", "discarded"];

export function toInboxStatus(status: MessageStatus): InboxStatus {
  return status === "drafting" ? "new" : status;
}

export interface InboxRow {
  id: number;
  channel: Channel;
  contactName: string | null;
  contactAddress: string;
  subject: string | null;
  excerpt: string;
  receivedAt: string;
  status: InboxStatus;
  reviewReason: string | null;
  sendMode: SendMode | null;
  simulated: boolean;
}

export const EXCERPT_LENGTH = 100;

export function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : flat;
}

export function listInbox(filters: { channel?: Channel; status?: InboxStatus } = {}): InboxRow[] {
  const where = ["m.direction = 'in'"];
  const params: Record<string, string> = {};
  if (filters.channel) {
    where.push("m.channel = @channel");
    params.channel = filters.channel;
  }
  if (filters.status) {
    where.push(filters.status === "new" ? "m.status IN ('new','drafting')" : "m.status = @status");
    if (filters.status !== "new") params.status = filters.status;
  }
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.channel, c.name AS contactName, c.external_id AS contactAddress, m.subject, m.body,
              m.received_at AS receivedAt, m.status, m.review_reason AS reviewReason, m.simulated,
              (SELECT o.send_mode FROM outbox o WHERE o.message_id = m.id AND o.send_mode != 'ack'
                ORDER BY o.id DESC LIMIT 1) AS sendMode
         FROM messages m JOIN contacts c ON c.id = m.contact_id
        WHERE ${where.join(" AND ")}
        ORDER BY m.received_at DESC, m.id DESC
        LIMIT 1000`,
    )
    .all(params) as (Omit<InboxRow, "excerpt" | "status" | "simulated"> & { body: string; status: MessageStatus; simulated: number })[];
  return rows.map(({ body, ...row }) => ({
    ...row,
    excerpt: excerpt(body),
    status: toInboxStatus(row.status),
    simulated: row.simulated === 1,
  }));
}

export interface CitationView extends Citation {
  /** The cited text with some surrounding lines of the current document, for the citation panel. */
  context: string | null;
  highlightStart: number;
  highlightEnd: number;
  documentChanged: boolean;
}

/** Locates the cited text in the current version of the document and adds surrounding lines. */
export function citationView(citation: Citation): CitationView {
  const row = getDb().prepare("SELECT text FROM documents WHERE id = ? AND status = 'ready'").get(citation.documentId) as
    | { text: string }
    | undefined;
  const at = row ? row.text.indexOf(citation.citedText) : -1;
  if (!row || at < 0) {
    return { ...citation, context: null, highlightStart: 0, highlightEnd: 0, documentChanged: true };
  }
  const text = row.text;
  const end = at + citation.citedText.length;
  let from = at;
  for (let i = 0; i < 2 && from > 0; i++) from = text.lastIndexOf("\n", from - 2) + 1;
  let to = end;
  for (let i = 0; i < 2 && to < text.length; i++) {
    const next = text.indexOf("\n", to + 1);
    to = next < 0 ? text.length : next;
  }
  return {
    ...citation,
    category: getDocument(citation.documentId)?.category ?? citation.category,
    context: text.slice(from, to),
    highlightStart: at - from,
    highlightEnd: end - from,
    documentChanged: false,
  };
}

export interface ThreadItem {
  direction: "in" | "out";
  text: string;
  subject: string | null;
  at: string;
  messageId: number | null;
  sendMode: SendMode | null;
}

export interface MessageDetail extends InboxRow {
  body: string;
  thread: ThreadItem[];
  draft: (Omit<StoredDraft, "citations"> & { citations: CitationView[] }) | null;
  reply: { text: string; mode: SendMode; sentAt: string } | null;
}

export function getMessageDetail(id: number): MessageDetail | null {
  const db = getDb();
  const message = db
    .prepare(
      `SELECT m.id, m.contact_id AS contactId, m.channel, c.name AS contactName, c.external_id AS contactAddress,
              m.subject, m.body, m.received_at AS receivedAt, m.status, m.review_reason AS reviewReason, m.simulated
         FROM messages m JOIN contacts c ON c.id = m.contact_id WHERE m.id = ? AND m.direction = 'in'`,
    )
    .get(id) as
    | (Omit<InboxRow, "excerpt" | "status" | "simulated" | "sendMode"> & { contactId: number; body: string; status: MessageStatus; simulated: number })
    | undefined;
  if (!message) return null;
  const { contactId, ...rest } = message;

  const thread = (
    db
      .prepare(
        `SELECT * FROM (
           SELECT 'in' AS direction, body AS text, subject, received_at AS at, id AS messageId, NULL AS sendMode
             FROM messages WHERE contact_id = @contact AND direction = 'in'
           UNION ALL
           SELECT 'out', text, NULL, sent_at, message_id, send_mode FROM outbox WHERE contact_id = @contact
         ) ORDER BY at`,
      )
      .all({ contact: contactId }) as ThreadItem[]
  ).slice(-50);

  const reply = db
    .prepare(
      `SELECT text, send_mode AS mode, sent_at AS sentAt FROM outbox
        WHERE message_id = ? AND send_mode != 'ack' ORDER BY id DESC LIMIT 1`,
    )
    .get(id) as MessageDetail["reply"] | undefined;

  const draft = latestDraft(id);
  return {
    ...rest,
    excerpt: excerpt(message.body),
    status: toInboxStatus(message.status),
    simulated: message.simulated === 1,
    sendMode: reply?.mode ?? null,
    thread,
    draft: draft ? { ...draft, citations: draft.citations.map(citationView) } : null,
    reply: reply ?? null,
  };
}

export class MessageActionError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_state" | "empty_text",
    message: string,
  ) {
    super(message);
    this.name = "MessageActionError";
  }
}

interface ActionRow {
  id: number;
  contact_id: number;
  channel: Channel;
  status: MessageStatus;
  previous_status: MessageStatus | null;
  address: string;
}

function loadForAction(id: number): ActionRow {
  const row = getDb()
    .prepare(
      `SELECT m.id, m.contact_id, m.channel, m.status, m.previous_status, c.external_id AS address
         FROM messages m JOIN contacts c ON c.id = m.contact_id WHERE m.id = ? AND m.direction = 'in'`,
    )
    .get(id) as ActionRow | undefined;
  if (!row) throw new MessageActionError("not_found", "El mensaje no existe.");
  return row;
}

/** How a reply is labelled: approved as drafted, edited, or written from scratch. */
export function replyMode(draftText: string | null, sentText: string): SendMode {
  if (!draftText) return "manual";
  return draftText.trim() === sentText.trim() ? "approved" : "edited";
}

/** «Aprobar y enviar» / «Enviar respuesta»: records the reply and closes the message. */
export function sendReply(id: number, text: string, sender: Sender = defaultSender()) {
  const row = loadForAction(id);
  if (row.status === "sent" || row.status === "discarded") {
    throw new MessageActionError("invalid_state", "Este mensaje ya está cerrado.");
  }
  if (!text.trim()) throw new MessageActionError("empty_text", "Escribe la respuesta antes de enviarla.");

  const mode = replyMode(latestDraft(id)?.text || null, text);
  const db = getDb();
  return db.transaction(() => {
    const sent = sender.send({ messageId: id, contactId: row.contact_id, channel: row.channel, recipient: row.address, text: text.trim(), mode });
    db.prepare("UPDATE messages SET status = 'sent', previous_status = NULL WHERE id = ?").run(id);
    return { mode, sentAt: sent.sentAt };
  })();
}

export function discardMessage(id: number): void {
  const row = loadForAction(id);
  if (row.status === "sent" || row.status === "discarded") {
    throw new MessageActionError("invalid_state", "Este mensaje no se puede descartar.");
  }
  getDb().prepare("UPDATE messages SET previous_status = status, status = 'discarded' WHERE id = ?").run(id);
}

export function reopenMessage(id: number): void {
  const row = loadForAction(id);
  if (row.status !== "discarded") throw new MessageActionError("invalid_state", "Solo se pueden reabrir mensajes descartados.");
  getDb()
    .prepare("UPDATE messages SET status = COALESCE(previous_status, 'needs_review'), previous_status = NULL WHERE id = ?")
    .run(id);
}

export interface ApprovalStats {
  reviewed: number;
  approvedUnchanged: number;
  percentUnchanged: number | null;
  autoSent: number;
}

/** Replies sent in the last `days` days: share approved without changes among those a person reviewed. */
export function approvalStats(days = 7, now: Date = new Date()): ApprovalStats {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const rows = getDb()
    .prepare("SELECT send_mode AS mode, COUNT(*) AS n FROM outbox WHERE sent_at >= ? GROUP BY send_mode")
    .all(since) as { mode: SendMode; n: number }[];
  const count = (mode: SendMode) => rows.find((r) => r.mode === mode)?.n ?? 0;
  const reviewed = count("approved") + count("edited") + count("manual");
  return {
    reviewed,
    approvedUnchanged: count("approved"),
    percentUnchanged: reviewed ? Math.round((count("approved") / reviewed) * 100) : null,
    autoSent: count("auto"),
  };
}
