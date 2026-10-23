import crypto from "node:crypto";
import { z } from "zod";
import { PayloadError, SIMULATED_WHATSAPP_PREFIX, type InboundMessage } from "./types";

/** Subset of the WhatsApp Cloud API webhook payload that we use. */
const messageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
});

const payloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).optional() })).optional(),
            messages: z.array(messageSchema).optional(),
          }),
        }),
      ),
    }),
  ),
});

export type WhatsAppPayload = z.infer<typeof payloadSchema>;

/** Turns a Cloud API webhook into messages; status updates (sent, read…) produce none. */
export function parseWhatsAppPayload(json: unknown): InboundMessage[] {
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) throw new PayloadError("El contenido no tiene el formato de WhatsApp Cloud API.");

  const out: InboundMessage[] = [];
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const names = new Map((change.value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));
      for (const message of change.value.messages ?? []) {
        const isText = message.type === "text" && message.text !== undefined;
        out.push({
          channel: "whatsapp",
          externalId: message.id,
          from: message.from,
          contactName: names.get(message.from) ?? null,
          subject: null,
          body: isText ? message.text!.body.trim() : "",
          kind: isText ? "text" : "unsupported",
          receivedAt: new Date(Number(message.timestamp) * 1000).toISOString(),
          simulated: message.id.startsWith(SIMULATED_WHATSAPP_PREFIX),
        });
      }
    }
  }
  return out;
}

export function signWhatsAppBody(rawBody: string, appSecret: string): string {
  return `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}

/** Checks the `X-Hub-Signature-256` header Meta sends with each webhook. */
export function verifyWhatsAppSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !/^sha256=[0-9a-f]{64}$/.test(header)) return false;
  const expected = Buffer.from(signWhatsAppBody(rawBody, appSecret));
  const received = Buffer.from(header);
  return crypto.timingSafeEqual(expected, received);
}

/** Signature verification is on when the Meta app secret is configured. */
export function verifySignatureIfConfigured(rawBody: string, header: string | null, appSecret: string | null): boolean {
  return appSecret === null || verifyWhatsAppSignature(rawBody, header, appSecret);
}

/** Answers Meta's subscription check: returns the challenge only for the configured token. */
export function verifySubscription(params: URLSearchParams, verifyToken: string): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || challenge === null) return null;
  const a = crypto.createHash("sha256").update(token).digest();
  const b = crypto.createHash("sha256").update(verifyToken).digest();
  return crypto.timingSafeEqual(a, b) ? challenge : null;
}

/** Builds a Cloud API payload with a single text message (used by the simulator). */
export function buildWhatsAppTextPayload(input: {
  id: string;
  from: string;
  name: string | null;
  text: string;
  timestamp: number;
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SIMULATOR",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "SIMULATOR", phone_number_id: "SIMULATOR" },
              contacts: [{ wa_id: input.from, profile: input.name ? { name: input.name } : undefined }],
              messages: [
                { from: input.from, id: input.id, timestamp: String(input.timestamp), type: "text", text: { body: input.text } },
              ],
            },
          },
        ],
      },
    ],
  };
}
