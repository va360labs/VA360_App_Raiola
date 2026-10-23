import { describe, expect, it, vi } from "vitest";
import { POST as retryRoute } from "@/app/api/messages/[id]/retry/route";
import { getDb } from "@/lib/db";
import { createDocument, deleteDocument, replaceDocument } from "@/lib/documents";
import { FakeDraftModel } from "@/lib/drafting/fake";
import type { DraftModel, DraftRequest, DraftResult } from "@/lib/drafting/model";
import { createDraftModel, draftMessage, latestDraft, REASONS, retryDraft } from "@/lib/drafting/service";
import { estimateTokens, ftsQuery, selectSources } from "@/lib/drafting/sources";
import { drainQueue, startWorker, stopWorker } from "@/lib/drafting/worker";
import { ingestMessages } from "@/lib/inbox/ingest";
import type { InboundMessage } from "@/lib/inbox/types";
import { claimNextJob, enqueueJob, pendingJobs, requeueStaleJobs } from "@/lib/jobs";
import { TARIFAS_40, TARIFAS_45, utf8 } from "../fixtures";
import { useTempDataDir } from "../helpers";

// Route-level session checks are covered in tests/integration/guard.test.ts.
vi.mock("@/lib/auth/guard", () => ({ requireSession: async () => null }));

let counter = 0;
function receive(body: string, overrides: Partial<InboundMessage> = {}): number {
  counter++;
  return ingestMessages([
    {
      channel: "whatsapp",
      externalId: `wamid.T${counter}`,
      from: "34600111222",
      contactName: "Lucía",
      subject: null,
      body,
      kind: "text",
      receivedAt: new Date(Date.UTC(2026, 9, 23, 8, counter)).toISOString(),
      simulated: false,
      ...overrides,
    },
  ]).messageIds[0];
}

function messageState(id: number) {
  return getDb().prepare("SELECT status, review_reason AS reason FROM messages WHERE id = ?").get(id);
}

class ScriptedModel implements DraftModel {
  readonly name = "scripted";
  requests: DraftRequest[] = [];
  constructor(private readonly result: Partial<DraftResult> | Error) {}
  async draft(request: DraftRequest): Promise<DraftResult> {
    this.requests.push(request);
    if (this.result instanceof Error) throw this.result;
    return { text: "", citations: [], escalation: null, refused: false, model: this.name, ...this.result };
  }
}

const fake = new FakeDraftModel();

describe("drafting", () => {
  useTempDataDir();

  async function withTarifas() {
    return createDocument({ name: "Tarifas 2026.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
  }

  it("prepares a cited answer from the documents (AC-20)", async () => {
    await withTarifas();
    const id = receive("¿Cuánto cuesta una sesión?");
    const started = Date.now();
    await draftMessage(id, fake);
    expect(Date.now() - started).toBeLessThan(15_000);

    expect(messageState(id)).toEqual({ status: "draft_ready", reason: null });
    const draft = latestDraft(id)!;
    expect(draft.text).toContain("40 €");
    expect(draft.grounded).toBe(true);
    expect(draft.citations[0]).toMatchObject({ documentName: "Tarifas 2026.txt", category: "tarifas" });
    expect(draft.citations[0].citedText).toContain("40 €");
    expect(draft.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("uses the new version after a document is replaced (AC-05)", async () => {
    const doc = await withTarifas();
    await replaceDocument(doc.id, { name: "Tarifas 2026.txt", bytes: utf8(TARIFAS_45) });
    const id = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(id, fake);
    const draft = latestDraft(id)!;
    expect(draft.text).toContain("45 €");
    expect(draft.text).not.toContain("40 €");
  });

  it("never cites a deleted document (AC-06)", async () => {
    const doc = await withTarifas();
    deleteDocument(doc.id);
    const id = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(id, fake);
    expect(messageState(id)).toEqual({ status: "needs_review", reason: REASONS.noInformation });
    expect(latestDraft(id)!.citations).toEqual([]);
  });

  it("sends a draft with a figure that is not in the cited text to review (AC-21)", async () => {
    await withTarifas();
    const id = receive("¿Cuánto cuesta una sesión?");
    const model = new ScriptedModel({
      text: "La sesión cuesta 35 €.",
      citations: [{ documentId: 1, documentName: "Tarifas 2026.txt", category: "tarifas", citedText: "Sesión de fisioterapia: 40 €", start: 0, end: 10 }],
    });
    await draftMessage(id, model);
    expect(messageState(id)).toEqual({ status: "needs_review", reason: REASONS.unsupportedFigure });
    expect(latestDraft(id)).toMatchObject({ text: "La sesión cuesta 35 €.", grounded: false });
  });

  it("answers in the language of the message (AC-22)", async () => {
    await withTarifas();
    const id = receive("How much is a session?");
    await draftMessage(id, fake);
    expect(latestDraft(id)!.text.startsWith("According to our information")).toBe(true);
  });

  it("does not invent an answer that is not in the documents (AC-24)", async () => {
    await withTarifas();
    const id = receive("¿Tenéis parking?");
    await draftMessage(id, fake);
    expect(messageState(id)).toEqual({ status: "needs_review", reason: REASONS.noInformation });
    expect(latestDraft(id)).toMatchObject({ text: "", citations: [], grounded: false });
  });

  it("always sends clinical questions to a person (AC-25)", async () => {
    await withTarifas();
    const id = receive("Me duele la rodilla, ¿qué ejercicios hago?");
    await draftMessage(id, fake);
    expect(messageState(id)).toEqual({ status: "needs_review", reason: REASONS.clinical });
  });

  it("sends to review when the model answers without citations or refuses", async () => {
    await withTarifas();
    const uncited = receive("¿Cuánto cuesta?");
    await draftMessage(uncited, new ScriptedModel({ text: "Cuesta poco." }));
    expect(messageState(uncited)).toEqual({ status: "needs_review", reason: REASONS.noInformation });

    const refused = receive("¿Cuánto cuesta?");
    await draftMessage(refused, new ScriptedModel({ refused: true }));
    expect(messageState(refused)).toEqual({ status: "needs_review", reason: REASONS.failed });
  });

  it("marks a failed generation for retry and queues it again (AC-26)", async () => {
    await withTarifas();
    const id = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(id, new ScriptedModel(new Error("Overloaded")));
    expect(messageState(id)).toEqual({ status: "needs_review", reason: REASONS.failed });

    getDb().prepare("UPDATE jobs SET status = 'done'").run();
    expect(retryDraft(id)).toBe("queued");
    expect(messageState(id)).toEqual({ status: "new", reason: null });
    expect(pendingJobs("draft")).toEqual([expect.objectContaining({ payload: { messageId: id } })]);

    await draftMessage(id, fake);
    expect(messageState(id)).toEqual({ status: "draft_ready", reason: null });
    expect(retryDraft(id)).toBe("not_retryable");
    expect(retryDraft(9999)).toBe("not_found");
  });

  it("fails cleanly when there is no API key", async () => {
    vi.stubEnv("DRAFT_MODEL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await withTarifas();
    const id = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(id);
    expect(messageState(id)).toEqual({ status: "needs_review", reason: REASONS.failed });
  });

  it("gives the model the recent history with the contact and the clinic name", async () => {
    await withTarifas();
    getDb().prepare("UPDATE settings SET value = 'Fisio Centro' WHERE key = 'clinic_name'").run();
    const first = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(first, fake);
    const row = getDb().prepare("SELECT contact_id, received_at FROM messages WHERE id = ?").get(first) as { contact_id: number; received_at: string };
    const sentAt = new Date(Date.parse(row.received_at) + 30_000).toISOString();
    getDb()
      .prepare("INSERT INTO outbox (message_id, contact_id, channel, recipient, text, send_mode, sent_at) VALUES (?, ?, 'whatsapp', 'x', 'Cuesta 40 €', 'approved', ?)")
      .run(first, row.contact_id, sentAt);
    const second = receive("¿Y el bono de 5?");
    const model = new ScriptedModel({ escalation: "no_information" });
    await draftMessage(second, model);
    expect(model.requests[0].history).toEqual([
      { from: "patient", text: "¿Cuánto cuesta una sesión?" },
      { from: "clinic", text: "Cuesta 40 €" },
    ]);
    expect(model.requests[0].clinicName).toBe("Fisio Centro");
  });

  it("skips messages that are not waiting for a draft", async () => {
    await withTarifas();
    const id = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(id, fake);
    expect(await draftMessage(id, fake)).toBeNull();
    expect(await draftMessage(424242, fake)).toBeNull();
    expect(latestDraft(424242)).toBeNull();
  });

  it("picks the fake model only when asked", () => {
    vi.stubEnv("DRAFT_MODEL", "fake");
    expect(createDraftModel().name).toBe("fake");
    vi.stubEnv("DRAFT_MODEL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "clave-de-prueba");
    expect(createDraftModel().name).toBe("claude-opus-5-5");
  });
});

describe("sources", () => {
  useTempDataDir();

  it("sends whole documents while they fit", async () => {
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    await createDocument({ name: "Escaneo.txt", bytes: utf8("1 2 3"), category: "otros" });
    expect(selectSources("precio")).toEqual([expect.objectContaining({ name: "Tarifas.txt", text: TARIFAS_40 })]);
  });

  it("switches to the best fragments when the documents are too large", async () => {
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    await createDocument({ name: "Horarios.txt", bytes: utf8("Horario de lunes a viernes de 9:00 a 20:00"), category: "horarios" });
    const sources = selectSources("¿Cuál es el horario del lunes?", 1);
    expect(sources.map((s) => s.name)).toEqual(["Horarios.txt"]);
    expect(selectSources("¿?", 1)).toEqual([]);
  });

  it("builds safe full-text queries", () => {
    expect(ftsQuery('¿Cuánto "cuesta" la sesión?')).toBe('"cuanto"* OR "cuesta"* OR "sesion"*');
    expect(ftsQuery("a ¿?")).toBeNull();
    expect(estimateTokens("12345678")).toBe(2);
  });
});

describe("worker", () => {
  useTempDataDir();

  it("drafts every queued message in order", async () => {
    vi.stubEnv("DRAFT_MODEL", "fake");
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const a = receive("¿Cuánto cuesta una sesión?");
    const b = receive("¿Tenéis parking?");
    expect(await drainQueue()).toBe(2);
    expect(messageState(a)).toMatchObject({ status: "draft_ready" });
    expect(messageState(b)).toMatchObject({ status: "needs_review" });
    expect(getDb().prepare("SELECT status, attempts FROM jobs").all()).toEqual([
      { status: "done", attempts: 1 },
      { status: "done", attempts: 1 },
    ]);
    expect(await drainQueue()).toBe(0);
  });

  it("records a job that throws as failed", async () => {
    getDb().prepare("INSERT INTO jobs (type, payload) VALUES ('draft', '{\"messageId\": 1}')").run();
    getDb().exec("DROP TABLE drafts");
    // The message does not exist, so drafting returns early without touching drafts; force a failure instead.
    getDb().exec("DROP TABLE messages");
    expect(await drainQueue()).toBe(1);
    expect(getDb().prepare("SELECT status, last_error IS NOT NULL AS hasError FROM jobs").get()).toEqual({ status: "failed", hasError: 1 });
  });

  it("puts jobs and messages left running by a restart back in the queue", () => {
    const id = receive("hola");
    claimNextJob();
    getDb().prepare("UPDATE messages SET status = 'drafting' WHERE id = ?").run(id);
    vi.stubEnv("DISABLE_WORKER", "");
    expect(startWorker(60_000)).toBe(true);
    expect(startWorker(60_000)).toBe(false);
    stopWorker();
    expect(pendingJobs("draft")).toHaveLength(1);
    expect(messageState(id)).toMatchObject({ status: "new" });
    expect(requeueStaleJobs()).toBe(0);
    stopWorker();
  });

  it("can be turned off and processes jobs on its own when on", async () => {
    vi.stubEnv("DISABLE_WORKER", "true");
    expect(startWorker()).toBe(false);
    vi.stubEnv("DISABLE_WORKER", "");
    vi.stubEnv("DRAFT_MODEL", "fake");
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const id = receive("¿Cuánto cuesta una sesión?");
    startWorker(20);
    await vi.waitFor(() => expect(messageState(id)).toMatchObject({ status: "draft_ready" }), { timeout: 3000 });
    stopWorker();
  });

  it("waits for jobs scheduled later", () => {
    getDb().prepare("INSERT INTO jobs (type, payload, run_after) VALUES ('draft', '{}', '2999-01-01T00:00:00.000Z')").run();
    expect(claimNextJob()).toBeNull();
    enqueueJob("draft", { messageId: 1 });
    expect(claimNextJob()).toMatchObject({ payload: { messageId: 1 }, attempts: 1 });
  });
});

describe("retry endpoint", () => {
  useTempDataDir();

  const call = (id: string) => retryRoute(new Request("http://localhost/api/messages/x/retry", { method: "POST" }), { params: Promise.resolve({ id }) });

  it("queues a failed draft, refuses others and 404s unknown messages", async () => {
    await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const id = receive("¿Cuánto cuesta una sesión?");
    await draftMessage(id, new ScriptedModel(new Error("timeout")));
    expect((await call(String(id))).status).toBe(202);
    expect((await call(String(id))).status).toBe(409);
    expect((await call("999")).status).toBe(404);
    expect((await call("abc")).status).toBe(404);
  });
});
