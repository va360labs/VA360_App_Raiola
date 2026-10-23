import crypto from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import { E2E_ENV } from "./env";

let counter = 0;

/** A name nobody else in the run uses, so tests can find their own rows. */
export function unique(prefix: string): string {
  counter++;
  return `${prefix} ${Date.now().toString(36)}${counter}`;
}

export function phone(): string {
  return `346${String(Date.now()).slice(-6)}${String(++counter).padStart(2, "0")}`;
}

export async function uploadDocument(request: APIRequestContext, name: string, text: string, category: string) {
  const response = await request.post("/api/documents", {
    multipart: { file: { name, mimeType: "text/plain", buffer: Buffer.from(text) }, category },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).document as { id: number; name: string; status: string };
}

export async function simulate(
  request: APIRequestContext,
  input: { channel: "whatsapp" | "email"; contact: string; name: string; text: string; subject?: string },
) {
  const response = await request.post("/api/simulator/send", { data: input });
  expect(response.status()).toBe(201);
}

export interface InboxMessage {
  id: number;
  contactName: string | null;
  status: string;
  reviewReason: string | null;
  sendMode: string | null;
  simulated: boolean;
  excerpt: string;
}

export async function findMessage(request: APIRequestContext, contactName: string): Promise<InboxMessage | undefined> {
  const { messages } = await (await request.get("/api/messages")).json();
  return (messages as InboxMessage[]).find((m) => m.contactName === contactName);
}

/** Waits until the message from this contact has been triaged (no longer «Nuevo»). */
export async function waitForTriage(request: APIRequestContext, contactName: string, timeout = 15_000): Promise<InboxMessage> {
  let found: InboxMessage | undefined;
  await expect
    .poll(
      async () => {
        found = await findMessage(request, contactName);
        return found && found.status !== "new" ? found.status : "pending";
      },
      { timeout },
    )
    .not.toBe("pending");
  return found!;
}

export function whatsappPayload(input: { id: string; from: string; name: string; text?: string; type?: string }) {
  const message =
    input.type && input.type !== "text"
      ? { from: input.from, id: input.id, timestamp: String(Math.floor(Date.now() / 1000)), type: input.type, image: { id: "1", mime_type: "image/jpeg" } }
      : { from: input.from, id: input.id, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: input.text ?? "" } };
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "E2E",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "34910000000", phone_number_id: "E2E" },
              contacts: [{ profile: { name: input.name }, wa_id: input.from }],
              messages: [message],
            },
          },
        ],
      },
    ],
  });
}

export function sign(body: string, secret: string = E2E_ENV.WHATSAPP_APP_SECRET): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

export async function postWhatsApp(request: APIRequestContext, body: string, signature: string | null = sign(body)) {
  return request.post("/api/webhooks/whatsapp", {
    data: body,
    headers: { "Content-Type": "application/json", ...(signature ? { "X-Hub-Signature-256": signature } : {}) },
  });
}

export async function setAutoSend(request: APIRequestContext, on: boolean) {
  const response = await request.put("/api/settings", { data: { autoSend: on } });
  expect(response.ok()).toBe(true);
}
