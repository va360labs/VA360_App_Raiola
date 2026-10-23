import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as emailWebhook } from "@/app/api/webhooks/email/route";
import { GET as whatsappVerify, POST as whatsappWebhook } from "@/app/api/webhooks/whatsapp/route";
import { GET as conversations } from "@/app/api/simulator/conversations/route";
import { POST as simulatorSend } from "@/app/api/simulator/send/route";
import { getSecrets } from "@/lib/config";
import { getDb } from "@/lib/db";
import { signWhatsAppBody } from "@/lib/inbox/whatsapp";
import { useTempDataDir } from "../helpers";
import { postmarkInbound, whatsappImage, whatsappText } from "../inbox-fixtures";

// Route-level session checks are covered in tests/integration/guard.test.ts.
vi.mock("@/lib/auth/guard", () => ({ requireSession: async () => null }));

const BASE = "http://localhost:3000";

function post(path: string, body: string, headers: Record<string, string> = {}) {
  return new NextRequest(`${BASE}${path}`, { method: "POST", body, headers: { "Content-Type": "application/json", ...headers } });
}

function messages() {
  return getDb().prepare("SELECT channel, body, status, simulated, review_reason AS reason FROM messages ORDER BY id").all();
}

describe("WhatsApp webhook", () => {
  useTempDataDir();

  it("answers Meta's verification with the challenge only for the configured token", async () => {
    const token = getSecrets().whatsappVerifyToken;
    const ok = whatsappVerify(new NextRequest(`${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=1158201444`));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("1158201444");

    const wrong = whatsappVerify(new NextRequest(`${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1`));
    expect(wrong.status).toBe(403);
  });

  it("stores a text message and answers 200 in under 2 seconds", async () => {
    const started = Date.now();
    const response = await whatsappWebhook(post("/api/webhooks/whatsapp", JSON.stringify(whatsappText())));
    expect(Date.now() - started).toBeLessThan(2000);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: 1, duplicates: 0 });
    expect(messages()).toEqual([{ channel: "whatsapp", body: "¿Cuánto cuesta una sesión?", status: "new", simulated: 0, reason: null }]);
    expect(getDb().prepare("SELECT external_id, name FROM contacts").get()).toEqual({ external_id: "34600111222", name: "Lucía Martín" });
  });

  it("keeps a single entry when Meta retries the same message", async () => {
    const body = JSON.stringify(whatsappText());
    await whatsappWebhook(post("/api/webhooks/whatsapp", body));
    const retry = await whatsappWebhook(post("/api/webhooks/whatsapp", body));
    expect(await retry.json()).toEqual({ received: 0, duplicates: 1 });
    expect(messages()).toHaveLength(1);
  });

  it("sends images to review", async () => {
    await whatsappWebhook(post("/api/webhooks/whatsapp", JSON.stringify(whatsappImage())));
    expect(messages()).toEqual([{ channel: "whatsapp", body: "", status: "needs_review", simulated: 0, reason: "Tipo de mensaje no soportado" }]);
  });

  it("rejects an invalid signature when the app secret is configured, and stores nothing", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "secreto-de-la-app");
    const body = JSON.stringify(whatsappText());

    const forged = await whatsappWebhook(post("/api/webhooks/whatsapp", body, { "X-Hub-Signature-256": signWhatsAppBody(body, "otro") }));
    expect(forged.status).toBe(401);
    const unsigned = await whatsappWebhook(post("/api/webhooks/whatsapp", body));
    expect(unsigned.status).toBe(401);
    expect(messages()).toEqual([]);

    const signed = await whatsappWebhook(post("/api/webhooks/whatsapp", body, { "X-Hub-Signature-256": signWhatsAppBody(body, "secreto-de-la-app") }));
    expect(signed.status).toBe(200);
  });

  it("answers 400 to bodies that are not Cloud API messages", async () => {
    expect((await whatsappWebhook(post("/api/webhooks/whatsapp", "no es json"))).status).toBe(400);
    expect((await whatsappWebhook(post("/api/webhooks/whatsapp", JSON.stringify({ a: 1 })))).status).toBe(400);
  });
});

describe("email webhook", () => {
  useTempDataDir();

  it("needs the webhook token", async () => {
    const body = JSON.stringify(postmarkInbound());
    expect((await emailWebhook(post("/api/webhooks/email", body))).status).toBe(401);
    expect((await emailWebhook(post("/api/webhooks/email", body, { "X-Webhook-Token": "otro" }))).status).toBe(401);
    expect(messages()).toEqual([]);
  });

  it("stores the email, by header or query token, without duplicates", async () => {
    const token = getSecrets().emailWebhookToken;
    const body = JSON.stringify(postmarkInbound());
    const started = Date.now();
    const first = await emailWebhook(post("/api/webhooks/email", body, { "X-Webhook-Token": token }));
    expect(Date.now() - started).toBeLessThan(2000);
    expect(await first.json()).toEqual({ received: 1, duplicates: 0 });

    const again = await emailWebhook(post(`/api/webhooks/email?token=${encodeURIComponent(token)}`, body));
    expect(await again.json()).toEqual({ received: 0, duplicates: 1 });

    expect(messages()).toEqual([{ channel: "email", body: "Hola, ¿abrís los sábados?\n\nGracias", status: "new", simulated: 0, reason: null }]);
    expect(getDb().prepare("SELECT subject FROM messages").get()).toEqual({ subject: "Horario del sábado" });
  });

  it("answers 400 to bodies that are not inbound emails", async () => {
    const token = getSecrets().emailWebhookToken;
    expect((await emailWebhook(post("/api/webhooks/email", "{", { "X-Webhook-Token": token }))).status).toBe(400);
    expect((await emailWebhook(post("/api/webhooks/email", "{}", { "X-Webhook-Token": token }))).status).toBe(400);
  });
});

describe("simulator", () => {
  useTempDataDir();
  afterEach(() => vi.unstubAllGlobals());

  /** Routes the simulator's own HTTP call to the webhook handlers, as the running server would. */
  function routeFetchToWebhooks() {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push(url);
      const request = new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
      return url.endsWith("/api/webhooks/whatsapp") ? whatsappWebhook(request) : emailWebhook(request);
    });
    return calls;
  }

  it("sends a WhatsApp message through the real webhook and tags it as simulated", async () => {
    vi.stubEnv("PORT", "");
    vi.stubEnv("INTERNAL_BASE_URL", "");
    const calls = routeFetchToWebhooks();
    const started = Date.now();
    const response = await simulatorSend(
      post("/api/simulator/send", JSON.stringify({ channel: "whatsapp", contact: "+34 600 111 222", name: "Lucía", text: "¿Cuánto cuesta una sesión?" })),
    );
    expect(response.status).toBe(201);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(calls).toEqual([`${BASE}/api/webhooks/whatsapp`]);
    expect(messages()).toEqual([{ channel: "whatsapp", body: "¿Cuánto cuesta una sesión?", status: "new", simulated: 1, reason: null }]);
  });

  it("sends an email through the email webhook", async () => {
    routeFetchToWebhooks();
    const response = await simulatorSend(
      post("/api/simulator/send", JSON.stringify({ channel: "email", contact: "ana@correo.es", subject: "Cita", text: "¿Puedo cambiar mi cita?" })),
    );
    expect(response.status).toBe(201);
    expect(messages()).toMatchObject([{ channel: "email", simulated: 1 }]);
  });

  it("works with the WhatsApp signature check on", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "secreto-de-la-app");
    routeFetchToWebhooks();
    const response = await simulatorSend(post("/api/simulator/send", JSON.stringify({ channel: "whatsapp", contact: "34600111222", text: "hola" })));
    expect(response.status).toBe(201);
  });

  it("explains invalid forms and reports a webhook that refuses the message", async () => {
    const invalid = await simulatorSend(post("/api/simulator/send", JSON.stringify({ channel: "email", contact: "x", text: "hola" })));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toBe("Escribe una dirección de email válida.");
    expect((await simulatorSend(post("/api/simulator/send", "no json"))).status).toBe(400);

    vi.stubGlobal("fetch", async () => new Response("no", { status: 500 }));
    expect((await simulatorSend(post("/api/simulator/send", JSON.stringify({ channel: "whatsapp", contact: "34600111222", text: "hola" })))).status).toBe(502);
    vi.stubGlobal("fetch", async () => {
      throw new Error("sin red");
    });
    expect((await simulatorSend(post("/api/simulator/send", JSON.stringify({ channel: "whatsapp", contact: "34600111222", text: "hola" })))).status).toBe(502);
  });

  it("lists the simulated conversations", async () => {
    routeFetchToWebhooks();
    await simulatorSend(post("/api/simulator/send", JSON.stringify({ channel: "whatsapp", contact: "34600111222", text: "hola" })));
    const body = await (await conversations(new Request("http://x"))).json();
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].items[0]).toMatchObject({ direction: "in", text: "hola", status: "new" });
  });
});
