import { getDb } from "@/lib/db";
import type { MessageStatus } from "@/lib/messages/status";
import type { Channel } from "./types";

export interface ConversationItem {
  direction: "in" | "out";
  text: string;
  subject: string | null;
  at: string;
  status: MessageStatus | null;
  reviewReason: string | null;
  sendMode: string | null;
}

export interface Conversation {
  contactId: number;
  channel: Channel;
  address: string;
  name: string | null;
  lastAt: string;
  items: ConversationItem[];
}

/**
 * Conversations of the contacts that wrote through the simulator: their
 * messages and the replies recorded as sent, oldest first, most recent
 * conversation first.
 */
export function listSimulatedConversations(): Conversation[] {
  const db = getDb();
  const contacts = db
    .prepare(
      `SELECT DISTINCT c.id, c.channel, c.external_id AS address, c.name
         FROM contacts c JOIN messages m ON m.contact_id = c.id
        WHERE m.simulated = 1`,
    )
    .all() as { id: number; channel: Channel; address: string; name: string | null }[];

  const inbound = db.prepare(
    `SELECT body AS text, subject, received_at AS at, status, review_reason AS reviewReason
       FROM messages WHERE contact_id = ? AND direction = 'in'`,
  );
  const outbound = db.prepare(`SELECT text, sent_at AS at, send_mode AS sendMode FROM outbox WHERE contact_id = ?`);

  return contacts
    .map((contact) => {
      const items: ConversationItem[] = [
        ...(inbound.all(contact.id) as Omit<ConversationItem, "direction" | "sendMode">[]).map((m) => ({
          ...m,
          direction: "in" as const,
          sendMode: null,
        })),
        ...(outbound.all(contact.id) as { text: string; at: string; sendMode: string }[]).map((o) => ({
          ...o,
          direction: "out" as const,
          subject: null,
          status: null,
          reviewReason: null,
        })),
      ].sort((a, b) => a.at.localeCompare(b.at));
      return {
        contactId: contact.id,
        channel: contact.channel,
        address: contact.address,
        name: contact.name,
        lastAt: items[items.length - 1].at,
        items,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
