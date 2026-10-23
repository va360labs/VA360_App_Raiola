import { expect, test, type Page } from "@playwright/test";
import { phone, setAutoSend, simulate, unique, waitForTriage } from "./helpers";

async function openMessage(page: Page, name: string) {
  await page.goto("/bandeja");
  await page.getByRole("button").filter({ hasText: name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test.describe("@US-03 @UC-301 Redactar el borrador citando los documentos", () => {
  test("AC-20 «¿Cuánto cuesta una sesión?» queda en «Borrador listo» en menos de 15 s con 40 € y una cita a las tarifas", async ({ page, request }) => {
    const name = unique("Precio");
    const started = Date.now();
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Cuánto cuesta una sesión?" });
    const message = await waitForTriage(request, name);
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(message.status).toBe("draft_ready");

    await openMessage(page, name);
    await expect(page.getByLabel("Texto de la respuesta")).toHaveValue(/40 €/);
    await expect(page.getByRole("button", { name: /Tarifas 2026\.txt: .*40 €/ })).toBeVisible();
  });

  test("AC-21 una cifra que no está en los fragmentos citados manda el mensaje a revisión", async ({ page, request }) => {
    const name = unique("Cifra inventada");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Cuánto cuesta una sesión? #cifra-inventada" });
    const message = await waitForTriage(request, name);
    expect(message).toMatchObject({ status: "needs_review", reviewReason: "Dato no encontrado en los documentos" });
    await openMessage(page, name);
    await expect(page.getByRole("note")).toContainText("Dato no encontrado en los documentos");
    await expect(page.getByText("Datos sin respaldo en las fuentes citadas")).toContainText("99 €");
  });

  test("AC-22 el borrador se redacta en el idioma del mensaje", async ({ request }) => {
    const english = unique("English");
    const spanish = unique("Español");
    await simulate(request, { channel: "whatsapp", contact: phone(), name: english, text: "How much is a session?" });
    await simulate(request, { channel: "whatsapp", contact: phone(), name: spanish, text: "¿Cuánto cuesta una sesión?" });
    const en = await waitForTriage(request, english);
    const es = await waitForTriage(request, spanish);
    const draft = async (id: number) => (await (await request.get(`/api/messages/${id}`)).json()).message.draft.text as string;
    expect(await draft(en.id)).toMatch(/^According to our information/);
    expect(await draft(es.id)).toMatch(/^Según nuestra información/);
  });

  test("AC-23 al pulsar una cita se ve el documento, su categoría y el fragmento con el texto citado resaltado", async ({ page, request }) => {
    const name = unique("Cita");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Cuánto cuesta una sesión?" });
    await waitForTriage(request, name);
    await openMessage(page, name);
    await page.getByRole("button", { name: /Tarifas 2026\.txt/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Fuente 1: Tarifas 2026.txt");
    await expect(dialog).toContainText("Categoría: Tarifas");
    await expect(dialog.locator("mark")).toHaveText("Sesión de fisioterapia (45 minutos): 40 €");
    await expect(dialog).toContainText("Bono de 5 sesiones");
  });
});

test.describe("@US-03 @UC-302 Pasar a una persona lo que no está claro", () => {
  test("AC-24 una pregunta sin respuesta en los documentos va a revisión sin datos", async ({ page, request }) => {
    const name = unique("Parking");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Tenéis parking?" });
    const message = await waitForTriage(request, name);
    expect(message).toMatchObject({ status: "needs_review", reviewReason: "No hay información en los documentos" });
    await openMessage(page, name);
    await expect(page.getByRole("heading", { name: "Escribe la respuesta" })).toBeVisible();
    await expect(page.getByLabel("Texto de la respuesta")).toHaveValue("");
  });

  test("AC-25 una consulta clínica va a revisión como «Consulta clínica», también con el envío automático activado", async ({ request }) => {
    await setAutoSend(request, true);
    try {
      const name = unique("Rodilla");
      await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "Me duele la rodilla, ¿qué ejercicios hago?" });
      const message = await waitForTriage(request, name);
      expect(message).toMatchObject({ status: "needs_review", reviewReason: "Consulta clínica" });
      expect(message.sendMode).toBeNull();
    } finally {
      await setAutoSend(request, false);
    }
  });

  test("AC-26 si falla la generación, el mensaje pasa a revisión con «Reintentar», que vuelve a lanzarla", async ({ page, request }) => {
    const name = unique("Fallo");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Cuánto cuesta? #fallo-de-prueba" });
    const message = await waitForTriage(request, name);
    expect(message).toMatchObject({ status: "needs_review", reviewReason: "No se pudo generar el borrador" });

    await openMessage(page, name);
    const retried = page.waitForResponse((r) => r.url().endsWith(`/api/messages/${message.id}/retry`));
    await page.getByRole("button", { name: "Reintentar" }).click();
    expect((await retried).status()).toBe(202);
    // The simulated failure repeats, so the message comes back to review after the new attempt.
    await expect(page.getByRole("note")).toContainText("No se pudo generar el borrador");
  });
});
