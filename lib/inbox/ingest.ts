import { getDb } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs";
import { afterTriage } from "@/lib/messages/autosend";
import type { InboundMessage } from "./types";

export const UNSUPPORTED_REASON = "Tipo de mensaje no soportado";

export interface IngestResult {
  received: number;
  duplicates: number;
  messageIds: number[];
}

/**
 * Stores inbound messages. A message whose provider id was already stored is
 * ignored, so webhook retries never create duplicates. Text messages are
 * queued for drafting; anything else goes straight to human review.
 */
export function ingestMessages(messages: InboundMessage[]): IngestResult {
  const db = getDb();
  const upsertContact = db.prepare(
    `INSERT INTO contacts (channel, external_id, name) VALUES (@channel, @from, @contactName)
     ON CONFLICT (channel, external_id) DO UPDATE SET name = COALESCE(excluded.name, contacts.name)
     RETURNING id`,
  );
  const insertMessage = db.prepare(
    `INSERT OR IGNORE INTO messages
       (contact_id, channel, direction, external_id, subject, body, kind, simulated, status, review_reason, received_at)
     VALUES (@contactId, @channel, 'in', @externalId, @subject, @body, @kind, @simulated, @status, @reviewReason, @receivedAt)`,
  );

  const unsupportedIds: number[] = [];
  const stored = db.transaction(() => {
    const result: IngestResult = { received: 0, duplicates: 0, messageIds: [] };
    for (const message of messages) {
      const contact = upsertContact.get(message) as { id: number };
      const unsupported = message.kind === "unsupported";
      const inserted = insertMessage.run({
        ...message,
        contactId: contact.id,
        simulated: message.simulated ? 1 : 0,
        status: unsupported ? "needs_review" : "new",
        reviewReason: unsupported ? UNSUPPORTED_REASON : null,
      });
      if (inserted.changes === 0) {
        result.duplicates++;
        continue;
      }
      const messageId = Number(inserted.lastInsertRowid);
      result.received++;
      result.messageIds.push(messageId);
      if (unsupported) unsupportedIds.push(messageId);
      else enqueueJob("draft", { messageId });
    }
    return result;
  })();

  // Messages that go straight to review still get the acknowledgement when automatic sending is on.
  unsupportedIds.forEach((id) => afterTriage(id));
  return stored;
}
