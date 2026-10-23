import { getDb } from "@/lib/db";
import type { Channel } from "@/lib/inbox/types";

export type SendMode = "approved" | "edited" | "manual" | "auto" | "ack";

export interface Outbound {
  messageId: number;
  contactId: number;
  channel: Channel;
  recipient: string;
  text: string;
  mode: SendMode;
}

/** Delivers a reply. v1 only records it; real WhatsApp and email senders plug in here later. */
export interface Sender {
  send(outbound: Outbound): { id: number; sentAt: string };
}

export class SimulatedSender implements Sender {
  send(outbound: Outbound) {
    const row = getDb()
      .prepare(
        `INSERT INTO outbox (message_id, contact_id, channel, recipient, text, send_mode, simulated)
         VALUES (?, ?, ?, ?, ?, ?, 1) RETURNING id, sent_at AS sentAt`,
      )
      .get(outbound.messageId, outbound.contactId, outbound.channel, outbound.recipient, outbound.text, outbound.mode) as {
      id: number;
      sentAt: string;
    };
    return row;
  }
}

export function defaultSender(): Sender {
  return new SimulatedSender();
}
