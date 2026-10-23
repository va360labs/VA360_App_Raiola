import { expect, test, type Page } from "@playwright/test";
import { findMessage, phone, setAutoSend, simulate, unique, waitForTriage } from "./helpers";

async function openMessage(page: Page, name: string) {
  await page.goto("/bandeja");
  await page.getByRole("button").filter({ hasText: name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

const outboxFor = async (page: Page, name: string) => {
  const { conversations } = await (await page.request.get("/api/simulator/conversations")).json();
  const conversation = conversations.find((c: { name: string }) => c.name === name);
  return (conversation?.items ?? []).filter((i: { direction: string }) => i.direction === "out");
};

test.describe("@US-04 @UC-401 Revisar, editar y aprobar respuestas", () => {
  test("AC-27 al editar y aprobar, el mensaje pasa a «Enviado» y la respuesta queda registrada", async ({ page, request }) => {
    const name = unique("Aprobar");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Cuánto cuesta una sesión?" });
    await waitForTriage(request, name);
    await openMessage(page, name);
    const reply = page.getByLabel("Texto de la respuesta");
    await reply.fill(`${await reply.inputValue()} ¡Te esperamos!`);
    await page.getByRole("button", { name: "Aprobar y enviar" }).click();

    await expect(page.getByRole("region", { name: "Respuesta enviada" })).toContainText("¡Te esperamos!");
    await expect(page.getByRole("region", { name: "Respuesta enviada" })).toContainText("Editada");
    await expect(page.locator("header").getByText("Enviado")).toBeVisible();
    const [sent] = await outboxFor(page, name);
    expect(sent).toMatchObject({ sendMode: "edited" });
    expect(sent.text).toContain("¡Te esperamos!");
  });

  test("AC-28 en un mensaje en revisión se puede escribir la respuesta desde cero y enviarla", async ({ page, request }) => {
    const name = unique("A mano");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Tenéis parking?" });
    await waitForTriage(request, name);
    await openMessage(page, name);
    await page.getByLabel("Texto de la respuesta").fill("Hay aparcamiento público a 50 metros de la clínica.");
    await page.getByRole("button", { name: "Enviar respuesta" }).click();
    await expect(page.getByRole("region", { name: "Respuesta enviada" })).toContainText("Escrita a mano");
    expect((await outboxFor(page, name))[0]).toMatchObject({ sendMode: "manual" });
  });

  test("AC-29 se puede descartar sin responder y reabrir después al estado anterior", async ({ page, request }) => {
    const name = unique("Descartar");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Cuánto cuesta una sesión?" });
    await waitForTriage(request, name);
    await openMessage(page, name);
    await page.getByRole("button", { name: "Descartar sin responder" }).click();
    await expect(page.locator("header").getByText("Descartado")).toBeVisible();
    await page.getByRole("button", { name: "Reabrir" }).click();
    await expect(page.locator("header").getByText("Borrador listo")).toBeVisible();
    expect((await findMessage(request, name))?.status).toBe("draft_ready");
  });

  test("AC-30 cada respuesta queda marcada y la bandeja muestra el % aprobadas sin cambios en 7 días", async ({ page, request }) => {
    const name = unique("Sin cambios");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Cuánto cuesta una sesión?" });
    await waitForTriage(request, name);
    await openMessage(page, name);
    await page.getByRole("button", { name: "Aprobar y enviar" }).click();
    await expect(page.getByRole("region", { name: "Respuesta enviada" })).toContainText("Aprobada sin cambios");

    const { stats } = await (await request.get("/api/messages")).json();
    expect(stats.approvedUnchanged).toBeGreaterThanOrEqual(1);
    await expect(page.getByText(/Últimos 7 días: \d+ % de las respuestas revisadas se aprobaron sin cambios/)).toContainText(
      `${stats.percentUnchanged} %`,
    );
  });
});

test.describe("@US-04 @UC-402 Activar el envío automático", () => {
  test.afterEach(async ({ request }) => setAutoSend(request, false));

  test("AC-31 desactivado al empezar; al activarlo, un borrador respaldado se envía solo en menos de 30 s", async ({ page, request }) => {
    expect((await (await request.get("/api/settings")).json()).settings.autoSend).toBe(false);
    await page.goto("/ajustes");
    await expect(page.getByText("Desactivado. Ninguna respuesta sale sin que alguien la apruebe.")).toBeVisible();
    await page.getByRole("button", { name: "Activar envío automático" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Activar envío automático" }).click();
    await expect(page.getByRole("status")).toHaveText("Envío automático activado.");

    const name = unique("Automático");
    const started = Date.now();
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Cuánto cuesta una sesión?" });
    const message = await waitForTriage(request, name);
    expect(Date.now() - started).toBeLessThan(30_000);
    expect(message).toMatchObject({ status: "sent", sendMode: "auto" });
    await page.goto("/bandeja");
    await expect(page.getByRole("button").filter({ hasText: name })).toContainText("Enviado automáticamente");
  });

  test("AC-32 con el envío automático, un mensaje en revisión recibe una sola vez el aviso de recepción", async ({ page, request }) => {
    await setAutoSend(request, true);
    const name = unique("Aviso");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Hacéis masajes deportivos?" });
    const message = await waitForTriage(request, name);
    expect(message.status).toBe("needs_review");
    const out = await outboxFor(page, name);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ sendMode: "ack", text: "Hemos recibido tu mensaje. Una persona del equipo te responderá lo antes posible." });
  });

  test("AC-33 al desactivarlo, el siguiente mensaje queda pendiente de aprobación", async ({ page, request }) => {
    await setAutoSend(request, true);
    await page.goto("/ajustes");
    await page.getByRole("button", { name: "Desactivar envío automático" }).click();
    await expect(page.getByRole("status")).toContainText("Envío automático desactivado");

    const name = unique("Tras desactivar");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Cuánto cuesta una sesión?" });
    const message = await waitForTriage(request, name);
    expect(message.status).toBe("draft_ready");
    expect(await outboxFor(page, name)).toHaveLength(0);
  });
});
