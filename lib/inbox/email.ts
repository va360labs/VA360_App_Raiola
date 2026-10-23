import crypto from "node:crypto";
import { z } from "zod";
import { PayloadError, SIMULATED_EMAIL_PREFIX, type InboundMessage } from "./types";

/** Subset of Postmark's inbound email webhook. */
const payloadSchema = z.object({
  MessageID: z.string().min(1),
  From: z.string().optional(),
  FromName: z.string().optional(),
  FromFull: z.object({ Email: z.string().min(3), Name: z.string().optional() }).optional(),
  Subject: z.string().optional(),
  TextBody: z.string().optional(),
  StrippedTextReply: z.string().optional(),
  Date: z.string().optional(),
});

export type InboundEmailPayload = z.infer<typeof payloadSchema>;

function senderAddress(payload: InboundEmailPayload): string | null {
  const raw = payload.FromFull?.Email ?? payload.From ?? "";
  const match = raw.match(/<([^>]+)>/);
  const address = (match ? match[1] : raw).trim().toLowerCase();
  return address.includes("@") ? address : null;
}

function parseDate(value: string | undefined): string {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function parseInboundEmail(json: unknown): InboundMessage {
  const parsed = payloadSchema.safeParse(json);
  const from = parsed.success ? senderAddress(parsed.data) : null;
  if (!parsed.success || !from) throw new PayloadError("El contenido no tiene el formato de un correo entrante.");

  const payload = parsed.data;
  // StrippedTextReply is the new text without the quoted history of the thread.
  const body = (payload.StrippedTextReply?.trim() || payload.TextBody?.trim() || "").trim();
  const name = (payload.FromFull?.Name || payload.FromName || "").trim();

  return {
    channel: "email",
    externalId: payload.MessageID,
    from,
    contactName: name || null,
    subject: payload.Subject?.trim() || null,
    body,
    kind: body ? "text" : "unsupported",
    receivedAt: parseDate(payload.Date),
    simulated: payload.MessageID.startsWith(SIMULATED_EMAIL_PREFIX),
  };
}

/** The email webhook needs the configured token in `X-Webhook-Token` or `?token=`. */
export function hasValidEmailToken(headers: Headers, params: URLSearchParams, expected: string): boolean {
  const received = headers.get("x-webhook-token") ?? params.get("token") ?? "";
  const a = crypto.createHash("sha256").update(received).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return received.length > 0 && crypto.timingSafeEqual(a, b);
}

/** Builds a Postmark-style inbound payload (used by the simulator). */
export function buildInboundEmailPayload(input: {
  id: string;
  from: string;
  name: string | null;
  subject: string | null;
  text: string;
  date: Date;
}): InboundEmailPayload {
  return {
    MessageID: input.id,
    From: input.from,
    FromName: input.name ?? "",
    FromFull: { Email: input.from, Name: input.name ?? "" },
    Subject: input.subject ?? "",
    TextBody: input.text,
    StrippedTextReply: input.text,
    Date: input.date.toUTCString(),
  };
}
