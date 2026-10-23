import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as listRoute } from "@/app/api/messages/route";
import { GET as detailRoute } from "@/app/api/messages/[id]/route";
import { POST as discardRoute } from "@/app/api/messages/[id]/discard/route";
import { POST as reopenRoute } from "@/app/api/messages/[id]/reopen/route";
import { POST as sendRoute } from "@/app/api/messages/[id]/send/route";
import { GET as getSettingsRoute, PUT as putSettingsRoute } from "@/app/api/settings/route";
import { getDb } from "@/lib/db";
import { createDocument, deleteDocument, replaceDocument } from "@/lib/documents";
import { FakeDraftModel } from "@/lib/drafting/fake";
import { draftMessage } from "@/lib/drafting/service";
import { ingestMessages } from "@/lib/inbox/ingest";
import type { InboundMessage } from "@/lib/inbox/types";
import {
  approvalStats,
  citationView,
  discardMessage,
  excerpt,
  getMessageDetail,
  listInbox,
  MessageActionError,
  reopenMessage,
  replyMode,
  sendReply,
} from "@/lib/messages";
import { afterTriage, autoSendEnabled } from "@/lib/messages/autosend";
import { inboxStatusLabel } from "@/lib/messages/status";
import { setSetting } from "@/lib/settings";
import { TARIFAS_40, TARIFAS_45, utf8 } from "../fixtures";
import { useTempDataDir } from "../helpers";

// Route-level session checks are covered in tests/integration/guard.test.ts.
vi.mock("@/lib/auth/guard", () => ({ requireSession: async () => null }));

let n = 0;
function receive(body: string, overrides: Partial<InboundMessage> = {}): number {
  n++;
  return ingestMessages([
    {
      channel: "whatsapp",
      externalId: `wamid.M${n}`,
      from: `3460000${String(n).padStart(4, "0")}`,
      contactName: `Paciente ${n}`,
      subject: null,
      body,
      kind: "text",
      receivedAt: new Date(Date.now() - (1000 - n) * 60_000).toISOString(),
      simulated: false,
      ...overrides,
    },
  ]).messageIds[0];
}

const fake = new FakeDraftModel();
const status = (id: number) => (getDb().prepare("SELECT status FROM messages WHERE id = ?").get(id) as { status: string }).status;
const outbox = () => getDb().prepare("SELECT message_id AS messageId, channel, recipient, text, send_mode AS mode FROM outbox ORDER BY id").all();
const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
const post = (body?: unknown) =>
  new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

describe("inbox", () => {
  useTempDataDir();

  it("lists both channels newest first with contact, excerpt, time and status (AC-16)", async () => {
    const a = receive("¿Cuánto cuesta una sesión?");
    const b = receive("x".repeat(150), { channel: "email", from: "ana@correo.es", contactName: null, subject: "Consulta" });
    const rows = listInbox();
    expect(rows.map((r) => r.id)).toEqual([b, a]);
    expect(rows[0]).toMatchObject({ channel: "email", contactName: null, contactAddress: "ana@correo.es", subject: "Consulta", status: "new" });
    expect(rows[0].excerpt).toHaveLength(100);
    expect(rows[0].excerpt.endsWith("…")).toBe(true);
    expect(rows[1]).toMatchObject({ channel: "whatsapp", excerpt: "¿Cuánto cuesta una sesión?", contactName: `Paciente ${n - 1}` });
  });

  it("filters by channel and status and counts what needs review (AC-17)", async () => {
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const price = receive("¿Cuánto cuesta una sesión?");
    const parking = receive("¿Tenéis parking?");
    const mail = receive("hola", { channel: "email", from: "a@b.es" });
    await draftMessage(price, fake);
    await draftMessage(parking, fake);
    getDb().prepare("UPDATE messages SET status = 'drafting' WHERE id = ?").run(mail);

    expect(listInbox({ channel: "email" }).map((r) => r.id)).toEqual([mail]);
    expect(listInbox({ status: "needs_review" }).map((r) => r.id)).toEqual([parking]);
    expect(listInbox({ status: "draft_ready" }).map((r) => r.id)).toEqual([price]);
    expect(listInbox({ status: "new" }).map((r) => r.id)).toEqual([mail]);

    const body = await (await listRoute(new NextRequest("http://localhost/api/messages?status=needs_review&channel=whatsapp"))).json();
    expect(body.messages.map((m: { id: number }) => m.id)).toEqual([parking]);
    expect(body.needsReview).toBe(1);
    const unfiltered = await (await listRoute(new NextRequest("http://localhost/api/messages?status=raro&channel=sms"))).json();
    expect(unfiltered.messages).toHaveLength(3);
  });

  it("opens a message with its history and its cited draft (AC-18, AC-23)", async () => {
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const first = receive("Hola", { from: "34611111111" });
    sendReply(first, "Hola, ¿en qué podemos ayudarte?");
    const id = receive("¿Cuánto cuesta una sesión?", { from: "34611111111", receivedAt: new Date(Date.now() + 120_000).toISOString() });
    await draftMessage(id, fake);

    const detail = getMessageDetail(id)!;
    expect(detail.thread.map((t) => [t.direction, t.text])).toEqual([
      ["in", "Hola"],
      ["out", "Hola, ¿en qué podemos ayudarte?"],
      ["in", "¿Cuánto cuesta una sesión?"],
    ]);
    expect(detail.draft!.text).toContain("40 €");
    const [citation] = detail.draft!.citations;
    expect(citation).toMatchObject({ documentName: "Tarifas.txt", category: "tarifas", documentChanged: false });
    expect(citation.context!.slice(citation.highlightStart, citation.highlightEnd)).toBe("Sesión de fisioterapia: 40 €");
    expect(citation.context).toContain("Bono de 5 sesiones");

    const res = await detailRoute(new Request("http://x"), ctx(id));
    expect((await res.json()).message.id).toBe(id);
    expect((await detailRoute(new Request("http://x"), ctx(999))).status).toBe(404);
    expect((await detailRoute(new Request("http://x"), ctx("abc"))).status).toBe(404);
    expect(getMessageDetail(999)).toBeNull();
  });

  it("warns when a cited document changed or was deleted", async () => {
    const doc = await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const citation = { documentId: doc.id, documentName: "Tarifas.txt", category: "tarifas" as const, citedText: "Sesión de fisioterapia: 40 €", start: 14, end: 42 };
    expect(citationView(citation).documentChanged).toBe(false);
    await replaceDocument(doc.id, { name: "Tarifas.txt", bytes: utf8(TARIFAS_45) });
    expect(citationView(citation)).toMatchObject({ documentChanged: true, context: null });
    deleteDocument(doc.id);
    expect(citationView(citation).documentChanged).toBe(true);
  });

  it("keeps short excerpts as they are", () => {
    expect(excerpt("  hola\n\nque tal ")).toBe("hola que tal");
  });
});

describe("review", () => {
  useTempDataDir();

  async function readyMessage() {
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const id = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(id, fake);
    return id;
  }

  it("labels replies as approved, edited or written by hand", () => {
    expect(replyMode("Cuesta 40 €", " Cuesta 40 € ")).toBe("approved");
    expect(replyMode("Cuesta 40 €", "Cuesta 40 €. ¡Te esperamos!")).toBe("edited");
    expect(replyMode(null, "Lo miro y te digo")).toBe("manual");
  });

  it("sends an edited draft and records it (AC-27)", async () => {
    const id = await readyMessage();
    const res = await sendRoute(post({ text: "La sesión cuesta 40 €. ¡Te esperamos!" }), ctx(id));
    expect(res.status).toBe(200);
    expect((await res.json()).result.mode).toBe("edited");
    expect(status(id)).toBe("sent");
    expect(outbox()).toEqual([
      { messageId: id, channel: "whatsapp", recipient: expect.stringMatching(/^346/), text: "La sesión cuesta 40 €. ¡Te esperamos!", mode: "edited" },
    ]);
    const detail = getMessageDetail(id)!;
    expect(detail.reply).toMatchObject({ text: "La sesión cuesta 40 €. ¡Te esperamos!", mode: "edited" });
    expect(detail.thread.at(-1)).toMatchObject({ direction: "out", sendMode: "edited" });
    expect(listInbox()[0]).toMatchObject({ status: "sent", sendMode: "edited" });
  });

  it("lets a person write the answer to an escalated message (AC-28)", async () => {
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const id = receive("¿Tenéis parking?");
    await draftMessage(id, fake);
    expect(status(id)).toBe("needs_review");
    expect(sendReply(id, "Hay aparcamiento público a 50 metros.").mode).toBe("manual");
    expect(status(id)).toBe("sent");
  });

  it("refuses empty replies and closed messages", async () => {
    const id = await readyMessage();
    expect((await sendRoute(post({ text: "  " }), ctx(id))).status).toBe(400);
    expect((await sendRoute(post(), ctx(id))).status).toBe(400);
    sendReply(id, "Cuesta 40 €");
    const again = await sendRoute(post({ text: "otra" }), ctx(id));
    expect(again.status).toBe(409);
    expect((await sendRoute(post({ text: "x" }), ctx(999))).status).toBe(404);
    expect((await sendRoute(post({ text: "x" }), ctx("abc"))).status).toBe(404);
    expect(() => discardMessage(id)).toThrow(MessageActionError);
  });

  it("discards and reopens to the previous status (AC-29)", async () => {
    const id = await readyMessage();
    expect((await discardRoute(post(), ctx(id))).status).toBe(200);
    expect(status(id)).toBe("discarded");
    expect((await discardRoute(post(), ctx(id))).status).toBe(409);
    expect((await reopenRoute(post(), ctx(id))).status).toBe(200);
    expect(status(id)).toBe("draft_ready");
    expect(() => reopenMessage(id)).toThrow(MessageActionError);
  });

  it("reports the share of reviewed replies approved without changes in 7 days (AC-30)", async () => {
    expect(approvalStats()).toEqual({ reviewed: 0, approvedUnchanged: 0, percentUnchanged: null, autoSent: 0 });
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const ids = [receive("¿Cuánto cuesta una sesión?"), receive("¿Cuánto cuesta una sesión?"), receive("¿Cuánto cuesta una sesión?"), receive("¿parking?")];
    for (const id of ids) await draftMessage(id, fake);
    sendReply(ids[0], getMessageDetail(ids[0])!.draft!.text);
    sendReply(ids[1], getMessageDetail(ids[1])!.draft!.text);
    sendReply(ids[2], "Otra cosa, 40 €");
    sendReply(ids[3], "No tenemos parking");
    getDb().prepare("INSERT INTO outbox (contact_id, channel, recipient, text, send_mode, sent_at) VALUES (1, 'whatsapp', 'x', 'viejo', 'approved', '2020-01-01T00:00:00.000Z')").run();
    expect(approvalStats()).toEqual({ reviewed: 4, approvedUnchanged: 2, percentUnchanged: 50, autoSent: 0 });
  });
});

describe("automatic sending", () => {
  useTempDataDir();

  it("is off by default and sends nothing without approval (AC-31, AC-33)", async () => {
    expect(autoSendEnabled()).toBe(false);
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const id = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(id, fake);
    expect(status(id)).toBe("draft_ready");
    expect(outbox()).toEqual([]);
  });

  it("sends backed drafts by itself once activated (AC-31)", async () => {
    setSetting("auto_send", "true");
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const started = Date.now();
    const id = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(id, fake);
    expect(Date.now() - started).toBeLessThan(30_000);
    expect(status(id)).toBe("sent");
    expect(outbox()).toEqual([expect.objectContaining({ messageId: id, mode: "auto", text: expect.stringContaining("40 €") })]);
    expect(listInbox()[0]).toMatchObject({ status: "sent", sendMode: "auto" });
    expect(inboxStatusLabel("sent", "auto")).toBe("Enviado automáticamente");
    expect(inboxStatusLabel("sent", "approved")).toBe("Enviado");
  });

  it("sends only the acknowledgement, once, to messages waiting for a person (AC-32)", async () => {
    setSetting("auto_send", "true");
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const clinical = receive("Me duele la espalda, ¿qué ejercicios hago?");
    await draftMessage(clinical, fake);
    expect(afterTriage(clinical)).toBe("already_acknowledged");

    const image = ingestMessages([
      { channel: "whatsapp", externalId: "wamid.IMG", from: "34699", contactName: null, subject: null, body: "", kind: "unsupported", receivedAt: new Date().toISOString(), simulated: false },
    ]).messageIds[0];

    expect(status(clinical)).toBe("needs_review");
    expect(outbox()).toEqual([
      expect.objectContaining({ messageId: clinical, mode: "ack", text: "Hemos recibido tu mensaje. Una persona del equipo te responderá lo antes posible." }),
      expect.objectContaining({ messageId: image, mode: "ack" }),
    ]);
  });

  it("stops sending as soon as it is turned off (AC-33)", async () => {
    setSetting("auto_send", "true");
    setSetting("auto_send", "false");
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const id = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(id, fake);
    expect(status(id)).toBe("draft_ready");
    expect(afterTriage(id)).toBe("off");
    expect(outbox()).toEqual([]);
  });

  it("skips unknown messages, closed ones and an empty acknowledgement", async () => {
    setSetting("auto_send", "true");
    expect(afterTriage(999)).toBe("skipped");
    const id = receive("hola");
    expect(afterTriage(id)).toBe("skipped");
    getDb().prepare("UPDATE messages SET status = 'needs_review' WHERE id = ?").run(id);
    setSetting("ack_message", "  ");
    expect(afterTriage(id)).toBe("skipped");
  });
});

describe("settings API", () => {
  useTempDataDir();

  const put = (body: unknown) => putSettingsRoute(new Request("http://x", { method: "PUT", body: JSON.stringify(body) }));

  it("reads and updates the settings", async () => {
    expect((await (await getSettingsRoute(new Request("http://x"))).json()).settings).toEqual({
      autoSend: false,
      ackMessage: "Hemos recibido tu mensaje. Una persona del equipo te responderá lo antes posible.",
      clinicName: "",
    });
    const res = await put({ autoSend: true, ackMessage: " Gracias, te respondemos pronto. ", clinicName: "Fisio Centro" });
    expect((await res.json()).settings).toEqual({ autoSend: true, ackMessage: "Gracias, te respondemos pronto.", clinicName: "Fisio Centro" });
    expect((await put({ autoSend: false })).status).toBe(200);
    expect(autoSendEnabled()).toBe(false);
  });

  it("rejects invalid values", async () => {
    expect((await put({ ackMessage: "  " })).status).toBe(400);
    expect((await put({ autoSend: "sí" })).status).toBe(400);
    expect((await putSettingsRoute(new Request("http://x", { method: "PUT", body: "nada" }))).status).toBe(400);
  });
});
