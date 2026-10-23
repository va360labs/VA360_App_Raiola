import { getDb } from "@/lib/db";
import type { Channel } from "@/lib/inbox/types";
import { defaultSender, type Sender } from "@/lib/sending/sender";
import { getSetting } from "@/lib/settings";

export function autoSendEnabled(): boolean {
  return getSetting("auto_send") === "true";
}

export type AutoSendResult = "off" | "sent" | "acknowledged" | "already_acknowledged" | "skipped";

/**
 * Runs after a message is triaged. With automatic sending on, a draft backed
 * by the documents is sent as is; a message waiting for a person gets the
 * acknowledgement once, never an answer with data.
 */
export function afterTriage(messageId: number, sender: Sender = defaultSender()): AutoSendResult {
  if (!autoSendEnabled()) return "off";
  const db = getDb();
  const row = db
    .prepare(
      `SELECT m.id, m.contact_id AS contactId, m.channel, m.status, c.external_id AS address,
              (SELECT text FROM drafts d WHERE d.message_id = m.id AND d.grounded = 1 ORDER BY d.id DESC LIMIT 1) AS draft
         FROM messages m JOIN contacts c ON c.id = m.contact_id WHERE m.id = ?`,
    )
    .get(messageId) as
    | { id: number; contactId: number; channel: Channel; status: string; address: string; draft: string | null }
    | undefined;
  if (!row) return "skipped";

  const base = { messageId: row.id, contactId: row.contactId, channel: row.channel, recipient: row.address };

  if (row.status === "draft_ready" && row.draft) {
    db.transaction(() => {
      sender.send({ ...base, text: row.draft!, mode: "auto" });
      db.prepare("UPDATE messages SET status = 'sent' WHERE id = ?").run(row.id);
    })();
    return "sent";
  }

  if (row.status === "needs_review") {
    const acknowledged = db.prepare("SELECT 1 FROM outbox WHERE message_id = ? AND send_mode = 'ack'").get(row.id);
    if (acknowledged) return "already_acknowledged";
    const text = getSetting("ack_message").trim();
    if (!text) return "skipped";
    sender.send({ ...base, text, mode: "ack" });
    return "acknowledged";
  }
  return "skipped";
}
