import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { listSimulatedConversations } from "@/lib/inbox/conversations";
import { buildInboundEmailPayload, hasValidEmailToken, parseInboundEmail } from "@/lib/inbox/email";
import { ingestMessages, UNSUPPORTED_REASON } from "@/lib/inbox/ingest";
import { buildSimulatedRequest, internalBaseUrl, simulatorInputSchema } from "@/lib/inbox/simulator";
import { PayloadError, type InboundMessage } from "@/lib/inbox/types";
import {
  buildWhatsAppTextPayload,
  parseWhatsAppPayload,
  signWhatsAppBody,
  verifySignatureIfConfigured,
  verifySubscription,
  verifyWhatsAppSignature,
} from "@/lib/inbox/whatsapp";
import { pendingJobs } from "@/lib/jobs";
import { useTempDataDir } from "../helpers";
import { postmarkInbound, whatsappImage, whatsappStatusOnly, whatsappText } from "../inbox-fixtures";

describe("WhatsApp payloads", () => {
  it("reads a text message with its contact name and time", () => {
    expect(parseWhatsAppPayload(whatsappText())).toEqual([
      {
        channel: "whatsapp",
        externalId: "wamid.HBgLMzQ2MDAxMTEyMjIVAgASGBQzQTdDRjdFRjE3QjA0QjM2RTlBNgA=",
        from: "34600111222",
        contactName: "Lucía Martín",
        subject: null,
        body: "¿Cuánto cuesta una sesión?",
        kind: "text",
        receivedAt: new Date(1792770000 * 1000).toISOString(),
        simulated: false,
      },
    ]);
  });

  it("marks images, audio and documents as unsupported", () => {
    const [message] = parseWhatsAppPayload(whatsappImage());
    expect(message).toMatchObject({ kind: "unsupported", body: "", contactName: "Lucía Martín" });
  });

  it("ignores status updates and non-message changes", () => {
    expect(parseWhatsAppPayload(whatsappStatusOnly())).toEqual([]);
    const other = whatsappText();
    other.entry[0].changes[0].field = "account_update";
    expect(parseWhatsAppPayload(other)).toEqual([]);
  });

  it("works without a contact profile", () => {
    const payload = whatsappText();
    const value: { contacts?: unknown } = payload.entry[0].changes[0].value;
    delete value.contacts;
    expect(parseWhatsAppPayload(payload)[0].contactName).toBeNull();
  });

  it("rejects anything that is not a Cloud API payload", () => {
    expect(() => parseWhatsAppPayload({ hola: 1 })).toThrow(PayloadError);
    expect(() => parseWhatsAppPayload(null)).toThrow(PayloadError);
  });

  it("recognises simulated messages by their id", () => {
    const payload = buildWhatsAppTextPayload({ id: "wamid.SIM.1", from: "34600", name: null, text: "hola", timestamp: 1 });
    expect(parseWhatsAppPayload(payload)[0]).toMatchObject({ simulated: true, contactName: null });
  });

  it("verifies the Meta signature of the raw body", () => {
    const body = JSON.stringify(whatsappText());
    const signature = signWhatsAppBody(body, "secreto");
    expect(verifyWhatsAppSignature(body, signature, "secreto")).toBe(true);
    expect(verifyWhatsAppSignature(`${body} `, signature, "secreto")).toBe(false);
    expect(verifyWhatsAppSignature(body, signature, "otro")).toBe(false);
    expect(verifyWhatsAppSignature(body, null, "secreto")).toBe(false);
    expect(verifyWhatsAppSignature(body, "sha256=corta", "secreto")).toBe(false);
    expect(verifySignatureIfConfigured(body, null, null)).toBe(true);
    expect(verifySignatureIfConfigured(body, null, "secreto")).toBe(false);
  });

  it("answers the subscription check only with the right token", () => {
    const ok = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "t0k", "hub.challenge": "1158201444" });
    expect(verifySubscription(ok, "t0k")).toBe("1158201444");
    expect(verifySubscription(ok, "otro")).toBeNull();
    expect(verifySubscription(new URLSearchParams({ "hub.mode": "unsubscribe", "hub.verify_token": "t0k", "hub.challenge": "1" }), "t0k")).toBeNull();
    expect(verifySubscription(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "t0k" }), "t0k")).toBeNull();
    expect(verifySubscription(new URLSearchParams({ "hub.mode": "subscribe", "hub.challenge": "1" }), "t0k")).toBeNull();
  });
});

describe("email payloads", () => {
  it("keeps only the new text of the reply", () => {
    expect(parseInboundEmail(postmarkInbound())).toEqual({
      channel: "email",
      externalId: "73e6d360-66eb-11e1-8e72-a8904824019b",
      from: "javier.ruiz@correo.es",
      contactName: "Javier Ruiz",
      subject: "Horario del sábado",
      body: "Hola, ¿abrís los sábados?\n\nGracias",
      kind: "text",
      receivedAt: "2026-10-23T08:15:00.000Z",
      simulated: false,
    });
  });

  it("falls back to the full text and to the From header", () => {
    const message = parseInboundEmail(
      postmarkInbound({ StrippedTextReply: "", FromFull: undefined, FromName: "", From: "Ana <ANA@correo.es>", Subject: "" }),
    );
    expect(message).toMatchObject({ from: "ana@correo.es", contactName: null, subject: null });
    expect(message.body).toContain("> mensaje anterior");
  });

  it("marks an email without text as unsupported and tolerates a bad date", () => {
    const message = parseInboundEmail(postmarkInbound({ StrippedTextReply: undefined, TextBody: "  ", Date: "ayer" }));
    expect(message.kind).toBe("unsupported");
    expect(Number.isNaN(Date.parse(message.receivedAt))).toBe(false);
    expect(parseInboundEmail(postmarkInbound({ Date: undefined })).receivedAt).toMatch(/^\d{4}-/);
  });

  it("rejects payloads without id or a valid sender", () => {
    expect(() => parseInboundEmail({ From: "a@b.es" })).toThrow(PayloadError);
    expect(() => parseInboundEmail(postmarkInbound({ FromFull: undefined, From: "sin arroba" }))).toThrow(PayloadError);
  });

  it("accepts the webhook token in the header or the query", () => {
    expect(hasValidEmailToken(new Headers({ "x-webhook-token": "abc" }), new URLSearchParams(), "abc")).toBe(true);
    expect(hasValidEmailToken(new Headers(), new URLSearchParams({ token: "abc" }), "abc")).toBe(true);
    expect(hasValidEmailToken(new Headers({ "x-webhook-token": "xyz" }), new URLSearchParams(), "abc")).toBe(false);
    expect(hasValidEmailToken(new Headers(), new URLSearchParams(), "abc")).toBe(false);
  });

  it("builds a Postmark-style payload that parses back", () => {
    const payload = buildInboundEmailPayload({ id: "sim-1", from: "a@b.es", name: null, subject: null, text: "hola", date: new Date("2026-10-23T08:00:00Z") });
    expect(parseInboundEmail(payload)).toMatchObject({ simulated: true, body: "hola", from: "a@b.es", contactName: null, subject: null });
  });
});

describe("storing messages", () => {
  useTempDataDir();

  const base: InboundMessage = {
    channel: "whatsapp",
    externalId: "wamid.A",
    from: "34600111222",
    contactName: "Lucía",
    subject: null,
    body: "¿Cuánto cuesta una sesión?",
    kind: "text",
    receivedAt: "2026-10-23T08:00:00.000Z",
    simulated: false,
  };

  it("stores a text message as new and queues it for drafting", () => {
    const result = ingestMessages([base]);
    expect(result).toMatchObject({ received: 1, duplicates: 0 });
    const row = getDb().prepare("SELECT status, body, review_reason FROM messages").get();
    expect(row).toEqual({ status: "new", body: "¿Cuánto cuesta una sesión?", review_reason: null });
    expect(pendingJobs("draft")).toEqual([{ id: 1, payload: { messageId: result.messageIds[0] } }]);
  });

  it("ignores a message that arrives twice", () => {
    ingestMessages([base]);
    expect(ingestMessages([base, base])).toMatchObject({ received: 0, duplicates: 2 });
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual({ n: 1 });
    expect(pendingJobs("draft")).toHaveLength(1);
  });

  it("reuses the contact and keeps the known name", () => {
    ingestMessages([base]);
    ingestMessages([{ ...base, externalId: "wamid.B", contactName: null }]);
    ingestMessages([{ ...base, externalId: "wamid.C", contactName: "Lucía M." }]);
    expect(getDb().prepare("SELECT name FROM contacts").all()).toEqual([{ name: "Lucía M." }]);
  });

  it("sends unsupported messages straight to review without drafting", () => {
    ingestMessages([{ ...base, kind: "unsupported", body: "" }]);
    expect(getDb().prepare("SELECT status, review_reason FROM messages").get()).toEqual({
      status: "needs_review",
      review_reason: UNSUPPORTED_REASON,
    });
    expect(pendingJobs("draft")).toEqual([]);
  });

  it("keeps the same id on different channels apart", () => {
    ingestMessages([base, { ...base, channel: "email", from: "a@b.es" }]);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual({ n: 2 });
  });

  it("lists simulated conversations with their replies in order", () => {
    ingestMessages([
      { ...base, externalId: "wamid.SIM.1", simulated: true, receivedAt: "2026-10-23T08:00:00.000Z" },
      { ...base, externalId: "real", simulated: false, from: "34999", receivedAt: "2026-10-23T09:00:00.000Z" },
      { ...base, channel: "email", from: "a@b.es", externalId: "sim-2", simulated: true, subject: "Hola", receivedAt: "2026-10-23T07:00:00.000Z" },
    ]);
    const contactId = (getDb().prepare("SELECT id FROM contacts WHERE external_id = '34600111222'").get() as { id: number }).id;
    getDb()
      .prepare("INSERT INTO outbox (contact_id, channel, recipient, text, send_mode, sent_at) VALUES (?, 'whatsapp', '34600111222', '40 €', 'approved', '2026-10-23T08:05:00.000Z')")
      .run(contactId);

    const conversations = listSimulatedConversations();
    expect(conversations.map((c) => c.address)).toEqual(["34600111222", "a@b.es"]);
    expect(conversations[0].items.map((i) => [i.direction, i.text])).toEqual([
      ["in", "¿Cuánto cuesta una sesión?"],
      ["out", "40 €"],
    ]);
    expect(conversations[0].items[0]).toMatchObject({ status: "new", sendMode: null });
    expect(conversations[0].items[1]).toMatchObject({ status: null, sendMode: "approved" });
    expect(conversations[1].items[0].subject).toBe("Hola");
  });
});

describe("simulator requests", () => {
  useTempDataDir();

  it("validates and normalises the form", () => {
    const wa = simulatorInputSchema.parse({ channel: "whatsapp", contact: "+34 600 111 222", text: "  hola " });
    expect(wa).toMatchObject({ contact: "34600111222", text: "hola" });
    const email = simulatorInputSchema.parse({ channel: "email", contact: " Ana@Correo.ES ", text: "hola" });
    expect(email.contact).toBe("ana@correo.es");
    expect(simulatorInputSchema.safeParse({ channel: "whatsapp", contact: "12", text: "hola" }).success).toBe(false);
    expect(simulatorInputSchema.safeParse({ channel: "email", contact: "no-es-email", text: "hola" }).success).toBe(false);
    expect(simulatorInputSchema.safeParse({ channel: "email", contact: "a@b.es", text: " " }).success).toBe(false);
    expect(simulatorInputSchema.safeParse({ channel: "sms", contact: "a", text: "b" }).success).toBe(false);
  });

  it("builds a WhatsApp webhook call, signed when the app secret is set", () => {
    const unsigned = buildSimulatedRequest({ channel: "whatsapp", contact: "34600111222", text: "hola" });
    expect(unsigned.path).toBe("/api/webhooks/whatsapp");
    expect(unsigned.headers["X-Hub-Signature-256"]).toBeUndefined();
    expect(parseWhatsAppPayload(JSON.parse(unsigned.body))[0]).toMatchObject({ simulated: true, body: "hola", contactName: null });

    vi.stubEnv("WHATSAPP_APP_SECRET", "secreto");
    const signed = buildSimulatedRequest({ channel: "whatsapp", contact: "34600111222", name: "Lucía", text: "hola" });
    expect(verifyWhatsAppSignature(signed.body, signed.headers["X-Hub-Signature-256"], "secreto")).toBe(true);
  });

  it("builds an email webhook call with the token", () => {
    const call = buildSimulatedRequest({ channel: "email", contact: "a@b.es", name: "Ana", subject: "Cita", text: "hola" });
    expect(call.path).toBe("/api/webhooks/email");
    expect(call.headers["X-Webhook-Token"]).toHaveLength(43);
    expect(parseInboundEmail(JSON.parse(call.body))).toMatchObject({ simulated: true, subject: "Cita", contactName: "Ana" });
    const plain = buildSimulatedRequest({ channel: "email", contact: "a@b.es", text: "hola" });
    expect(parseInboundEmail(JSON.parse(plain.body))).toMatchObject({ subject: null, contactName: null });
  });

  it("knows how to reach its own webhooks", () => {
    vi.stubEnv("INTERNAL_BASE_URL", "");
    vi.stubEnv("PORT", "");
    expect(internalBaseUrl("https://clinica.example")).toBe("https://clinica.example");
    vi.stubEnv("PORT", "3000");
    expect(internalBaseUrl("https://clinica.example")).toBe("http://127.0.0.1:3000");
    vi.stubEnv("INTERNAL_BASE_URL", "http://app:3000/");
    expect(internalBaseUrl("https://clinica.example")).toBe("http://app:3000");
  });
});
