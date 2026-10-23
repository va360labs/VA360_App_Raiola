import { expect, test } from "@playwright/test";
import { E2E_ENV } from "./env";
import { findMessage, phone, postWhatsApp, sign, simulate, unique, waitForTriage, whatsappPayload } from "./helpers";

test.describe("@US-02 @UC-201 Recibir mensajes de WhatsApp por webhook", () => {
  test("AC-07 la verificación de Meta devuelve el challenge con el token correcto y 403 si no", async ({ request }) => {
    const ok = await request.get(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${E2E_ENV.WHATSAPP_VERIFY_TOKEN}&hub.challenge=1158201444`);
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toBe("1158201444");
    const wrong = await request.get("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1");
    expect(wrong.status()).toBe(403);
  });

  test("AC-08 un mensaje de texto responde 200 en menos de 2 s y aparece en la bandeja", async ({ page, request }) => {
    const name = unique("Lucía WA");
    const from = phone();
    const body = whatsappPayload({ id: `wamid.E2E.${Date.now()}`, from, name, text: "¿Abrís los sábados?" });
    const started = Date.now();
    const response = await postWhatsApp(request, body);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(response.status()).toBe(200);

    await page.goto("/bandeja");
    const row = page.getByRole("button").filter({ hasText: name });
    await expect(row).toContainText("¿Abrís los sábados?");
    await expect(row.getByLabel("WhatsApp")).toBeVisible();
    await row.click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText(`WhatsApp, ${from}`)).toBeVisible();
  });

  test("AC-09 el mismo mensaje dos veces deja una sola entrada", async ({ request }) => {
    const name = unique("Duplicado");
    const body = whatsappPayload({ id: `wamid.DUP.${Date.now()}`, from: phone(), name, text: "hola" });
    await postWhatsApp(request, body);
    const retry = await postWhatsApp(request, body);
    expect(await retry.json()).toEqual({ received: 0, duplicates: 1 });
    const { messages } = await (await request.get("/api/messages")).json();
    expect(messages.filter((m: { contactName: string }) => m.contactName === name)).toHaveLength(1);
  });

  test("AC-10 con la verificación de firma activa, una firma que no coincide da 401 y no se guarda", async ({ request }) => {
    const name = unique("Firma falsa");
    const body = whatsappPayload({ id: `wamid.SIG.${Date.now()}`, from: phone(), name, text: "hola" });
    expect((await postWhatsApp(request, body, sign(body, "otro-secreto"))).status()).toBe(401);
    expect((await postWhatsApp(request, body, null)).status()).toBe(401);
    expect(await findMessage(request, name)).toBeUndefined();
  });

  test("AC-11 un mensaje que no es de texto aparece como «Tipo de mensaje no soportado» en revisión", async ({ page, request }) => {
    const name = unique("Foto");
    await postWhatsApp(request, whatsappPayload({ id: `wamid.IMG.${Date.now()}`, from: phone(), name, type: "image" }));
    await page.goto("/bandeja");
    await page.getByRole("button").filter({ hasText: name }).click();
    await expect(page.getByRole("note")).toContainText("Tipo de mensaje no soportado");
    await expect(page.getByRole("button").filter({ hasText: name })).toContainText("Requiere revisión");
  });
});

test.describe("@US-02 @UC-202 Recibir emails por webhook", () => {
  const email = (name: string, id: string, address: string) => ({
    MessageID: id,
    From: address,
    FromFull: { Email: address, Name: name },
    Subject: "Pregunta por email",
    TextBody: "¿Cuál es el horario de los sábados?",
    StrippedTextReply: "¿Cuál es el horario de los sábados?",
    Date: new Date().toUTCString(),
  });

  test("AC-12 un correo entrante responde 200 en menos de 2 s y aparece con remitente y asunto", async ({ page, request }) => {
    const name = unique("Javier Email");
    const started = Date.now();
    const response = await request.post("/api/webhooks/email", {
      data: email(name, `e2e-${Date.now()}@correo.es`, `javier.${Date.now()}@correo.es`),
      headers: { "X-Webhook-Token": E2E_ENV.EMAIL_WEBHOOK_TOKEN },
    });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(response.status()).toBe(200);
    await page.goto("/bandeja");
    const row = page.getByRole("button").filter({ hasText: name });
    await expect(row).toContainText("Pregunta por email");
    await expect(row.getByLabel("Email")).toBeVisible();
  });

  test("AC-13 sin token se responde 401 y no se guarda; el mismo identificador dos veces deja una entrada", async ({ request }) => {
    const name = unique("Token");
    const payload = email(name, `e2e-tok-${Date.now()}@correo.es`, `tok.${Date.now()}@correo.es`);
    expect((await request.post("/api/webhooks/email", { data: payload })).status()).toBe(401);
    expect(await findMessage(request, name)).toBeUndefined();
    await request.post(`/api/webhooks/email?token=${E2E_ENV.EMAIL_WEBHOOK_TOKEN}`, { data: payload });
    await request.post(`/api/webhooks/email?token=${E2E_ENV.EMAIL_WEBHOOK_TOKEN}`, { data: payload });
    const { messages } = await (await request.get("/api/messages")).json();
    expect(messages.filter((m: { contactName: string }) => m.contactName === name)).toHaveLength(1);
  });
});

test.describe("@US-02 @UC-203 Simular mensajes", () => {
  test("AC-14 el simulador envía por el mismo webhook y el mensaje aparece con «Simulado» en menos de 5 s", async ({ page }) => {
    const name = unique("Simulada");
    await page.goto("/simulador");
    await page.getByLabel("Teléfono").fill("+34 600 141 414");
    await page.getByLabel("Nombre (opcional)").fill(name);
    await page.getByRole("textbox", { name: "Mensaje" }).fill("¿Cuánto cuesta una sesión?");
    const started = Date.now();
    await page.getByRole("button", { name: "Enviar mensaje de prueba" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Mensaje recibido por el webhook de WhatsApp." })).toBeVisible();

    await page.goto("/bandeja");
    const row = page.getByRole("button").filter({ hasText: name });
    await expect(row).toContainText("Simulado", { timeout: 5000 });
    expect(Date.now() - started).toBeLessThan(5000 + 2000);
  });

  test("AC-15 la conversación simulada muestra mensajes y respuestas en orden y se actualiza sin recargar", async ({ page, request }) => {
    const name = unique("Conversación");
    const from = "34600151515";
    await simulate(request, { channel: "whatsapp", contact: from, name, text: "Primer mensaje" });
    const first = await waitForTriage(request, name);
    await request.post(`/api/messages/${first.id}/send`, { data: { text: "Respuesta de la clínica" } });

    await page.goto("/simulador");
    await page.getByLabel("Contacto").selectOption({ label: `${name} (${from})` });
    const items = page.locator("ol[aria-live=polite] li");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Primer mensaje");
    await expect(items.nth(1)).toContainText("Respuesta de la clínica");

    await postWhatsApp(request, whatsappPayload({ id: `wamid.SIM.${Date.now()}`, from, name, text: "Segundo mensaje" }));
    await expect(items).toHaveCount(3, { timeout: 10_000 });
    await expect(items.nth(2)).toContainText("Segundo mensaje");
  });
});

test.describe("@US-02 @UC-204 Consultar la bandeja", () => {
  test("AC-16 la bandeja lista ambos canales del más reciente al más antiguo con canal, contacto, extracto, hora y estado", async ({ page, request }) => {
    const older = unique("Antiguo");
    const newer = unique("Reciente");
    const long = `Hola, ${"quería preguntar por las tarifas de la clínica y los horarios ".repeat(3)}`;
    await simulate(request, { channel: "email", contact: `a${Date.now()}@correo.es`, name: older, subject: "Consulta", text: "Mensaje anterior" });
    await page.waitForTimeout(1100);
    await simulate(request, { channel: "whatsapp", contact: phone(), name: newer, text: long });

    await page.goto("/bandeja");
    const rows = page.locator("section[aria-label=Mensajes] li");
    const texts = await rows.allInnerTexts();
    const iNew = texts.findIndex((t) => t.includes(newer));
    const iOld = texts.findIndex((t) => t.includes(older));
    expect(iNew).toBeGreaterThanOrEqual(0);
    expect(iNew).toBeLessThan(iOld);
    const row = rows.nth(iNew);
    await expect(row.getByLabel("WhatsApp")).toBeVisible();
    await expect(row).toContainText(/\d{2}:\d{2}/);
    await expect(row).toContainText(/Nuevo|Borrador listo|Requiere revisión/);
    const excerpt = (await row.locator("span.block").innerText()).trim();
    expect(excerpt.length).toBeLessThanOrEqual(100);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  test("AC-17 la bandeja filtra por canal y estado y muestra cuántos mensajes requieren revisión", async ({ page, request }) => {
    const name = unique("Parking filtro");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Tenéis parking?" });
    await waitForTriage(request, name);
    const { needsReview } = await (await request.get("/api/messages")).json();

    await page.goto("/bandeja");
    await expect(page.getByRole("status").filter({ hasText: "por revisar" })).toHaveText(`${needsReview} por revisar`);
    await page.getByLabel("Estado").selectOption("needs_review");
    await page.getByLabel("Canal").selectOption("whatsapp");
    await expect(page).toHaveURL(/estado=needs_review/);
    await expect(page.getByRole("button").filter({ hasText: name })).toBeVisible();
    const chips = await page.locator("section[aria-label=Mensajes] li").allInnerTexts();
    expect(chips.every((t) => t.includes("Requiere revisión"))).toBe(true);
    await page.getByLabel("Canal").selectOption("email");
    await expect(page.getByRole("button").filter({ hasText: name })).toHaveCount(0);
  });

  test("AC-18 al abrir un mensaje se ve el texto completo, el historial y el borrador con sus citas", async ({ page, request }) => {
    const name = unique("Historial");
    const contact = phone();
    await simulate(request, { channel: "whatsapp", contact, name, text: "Hola, buenos días" });
    const first = await waitForTriage(request, name);
    await request.post(`/api/messages/${first.id}/send`, { data: { text: "Buenos días, ¿en qué te ayudamos?" } });
    await simulate(request, { channel: "whatsapp", contact, name, text: "¿Cuánto cuesta una sesión de fisioterapia?" });

    await page.goto("/bandeja");
    await page.getByRole("button").filter({ hasText: "¿Cuánto cuesta una sesión de fisioterapia?" }).filter({ hasText: name }).click();
    const conversation = page.getByRole("region", { name: "Conversación" });
    await expect(conversation).toContainText("Hola, buenos días");
    await expect(conversation).toContainText("Buenos días, ¿en qué te ayudamos?");
    await expect(conversation).toContainText("¿Cuánto cuesta una sesión de fisioterapia?");
    await expect(page.getByLabel("Texto de la respuesta")).toHaveValue(/40 €/);
    await expect(page.getByRole("button", { name: /Tarifas 2026\.txt/ })).toBeVisible();
  });

  test("AC-19 un mensaje nuevo aparece en la bandeja abierta sin recargar en menos de 10 s", async ({ page, request }) => {
    await page.goto("/bandeja");
    const name = unique("En directo");
    await postWhatsApp(request, whatsappPayload({ id: `wamid.LIVE.${Date.now()}`, from: phone(), name, text: "¿Seguís abiertos hoy?" }));
    await expect(page.getByRole("button").filter({ hasText: name })).toBeVisible({ timeout: 10_000 });
  });
});
