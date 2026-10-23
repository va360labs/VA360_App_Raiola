import crypto from "node:crypto";
import { z } from "zod";
import { getSecrets, whatsappAppSecret } from "@/lib/config";
import { buildInboundEmailPayload } from "./email";
import { SIMULATED_EMAIL_PREFIX, SIMULATED_WHATSAPP_PREFIX } from "./types";
import { buildWhatsAppTextPayload, signWhatsAppBody } from "./whatsapp";

export const simulatorInputSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("whatsapp"),
    contact: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().min(6, "Escribe un número de teléfono.")),
    name: z.string().trim().max(80).optional(),
    text: z.string().trim().min(1, "Escribe el mensaje.").max(4000),
  }),
  z.object({
    channel: z.literal("email"),
    contact: z.string().trim().toLowerCase().pipe(z.email("Escribe una dirección de email válida.")),
    name: z.string().trim().max(80).optional(),
    subject: z.string().trim().max(200).optional(),
    text: z.string().trim().min(1, "Escribe el mensaje.").max(20000),
  }),
]);

export type SimulatorInput = z.infer<typeof simulatorInputSchema>;

export interface WebhookCall {
  path: string;
  body: string;
  headers: Record<string, string>;
}

/**
 * Builds the exact request a real provider would send, so the simulated
 * message goes through the same webhook as a real one.
 */
export function buildSimulatedRequest(input: SimulatorInput, now: Date = new Date()): WebhookCall {
  const id = crypto.randomUUID();
  if (input.channel === "whatsapp") {
    const body = JSON.stringify(
      buildWhatsAppTextPayload({
        id: `${SIMULATED_WHATSAPP_PREFIX}${id}`,
        from: input.contact,
        name: input.name || null,
        text: input.text,
        timestamp: Math.floor(now.getTime() / 1000),
      }),
    );
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const secret = whatsappAppSecret();
    if (secret) headers["X-Hub-Signature-256"] = signWhatsAppBody(body, secret);
    return { path: "/api/webhooks/whatsapp", body, headers };
  }

  const body = JSON.stringify(
    buildInboundEmailPayload({
      id: `${SIMULATED_EMAIL_PREFIX}${id}@simulador.local`,
      from: input.contact,
      name: input.name || null,
      subject: input.subject || null,
      text: input.text,
      date: now,
    }),
  );
  return {
    path: "/api/webhooks/email",
    body,
    headers: { "Content-Type": "application/json", "X-Webhook-Token": getSecrets().emailWebhookToken },
  };
}

/** Where the server can reach itself: explicit setting, the local port, or the request origin. */
export function internalBaseUrl(requestOrigin: string): string {
  if (process.env.INTERNAL_BASE_URL) return process.env.INTERNAL_BASE_URL.replace(/\/$/, "");
  if (process.env.PORT) return `http://127.0.0.1:${process.env.PORT}`;
  return requestOrigin;
}
