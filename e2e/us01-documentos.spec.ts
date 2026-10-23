import { expect, test } from "@playwright/test";
import { makePdf } from "../tests/fixtures";
import { simulate, unique, uploadDocument, waitForTriage } from "./helpers";

test.describe("@US-01 @UC-101 Subir documentos", () => {
  test("AC-01 un TXT de hasta 10 MB aparece en la lista como «Listo» en menos de 30 segundos", async ({ page }) => {
    const name = `${unique("Preguntas frecuentes")}.txt`;
    await page.goto("/documentos");
    await page.getByRole("button", { name: "Subir documento" }).click();
    await page.getByLabel("Archivo").setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from("¿Atendéis a domicilio? No, solo en la clínica.") });
    await page.getByLabel("Categoría", { exact: true }).selectOption("faq");
    const started = Date.now();
    await page.getByRole("dialog").getByRole("button", { name: "Subir documento" }).click();
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toContainText("Listo");
    await expect(row).toContainText("Preguntas frecuentes");
    expect(Date.now() - started).toBeLessThan(30_000);
  });

  test("AC-02 un archivo de otro formato se rechaza con el motivo y no aparece", async ({ page }) => {
    await page.goto("/documentos");
    await page.getByRole("button", { name: "Subir documento" }).click();
    await page.getByLabel("Archivo").setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from("x") });
    await page.getByLabel("Categoría", { exact: true }).selectOption("otros");
    await page.getByRole("dialog").getByRole("button", { name: "Subir documento" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("Formato no admitido. Sube un PDF, DOCX, TXT o Markdown.");
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("foto.jpg")).toHaveCount(0);
  });

  test("AC-02 un archivo de más de 10 MB se rechaza", async ({ request }) => {
    const response = await request.post("/api/documents", {
      multipart: { file: { name: "grande.txt", mimeType: "text/plain", buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 97) }, category: "otros" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("El archivo supera el máximo de 10 MB.");
  });

  test("AC-03 la categoría se elige al subir y la lista se filtra por ella", async ({ page, request }) => {
    const name = unique("Horario de verano");
    await uploadDocument(request, `${name}.txt`, "En agosto abrimos de 9:00 a 14:00.", "horarios");
    await page.goto("/documentos");
    await page.getByRole("link", { name: "Horarios", exact: true }).click();
    await expect(page).toHaveURL(/categoria=horarios/);
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Tarifas 2026.txt" })).toHaveCount(0);
  });

  test("AC-04 un PDF sin texto queda «Sin texto», con aviso, y no se usa", async ({ page, request }) => {
    const name = `${unique("Escaneo")}.pdf`;
    const response = await request.post("/api/documents", {
      multipart: { file: { name, mimeType: "application/pdf", buffer: Buffer.from(makePdf(null)) }, category: "politicas" },
    });
    expect((await response.json()).document.status).toBe("no_text");
    await page.goto("/documentos");
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toContainText("Sin texto");
    await expect(row).toContainText("Sube una versión con texto");
  });
});

test.describe("@US-01 @UC-102 Mantener los documentos al día", () => {
  test("AC-05 tras reemplazar 40 € por 45 €, el siguiente borrador dice 45 € y no 40 €", async ({ page, request }) => {
    const doc = await uploadDocument(request, `${unique("Drenaje")}.txt`, "Drenaje linfático manual: 40 €", "tarifas");
    await page.goto("/documentos");
    await page.getByRole("listitem").filter({ hasText: doc.name }).getByRole("button", { name: "Reemplazar" }).click();
    await page.getByLabel("Archivo").setInputFiles({ name: doc.name, mimeType: "text/plain", buffer: Buffer.from("Drenaje linfático manual: 45 €") });
    await page.getByRole("button", { name: "Subir nueva versión" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: doc.name })).toContainText("versión 2");

    const contact = unique("Paciente AC05");
    await simulate(request, { channel: "whatsapp", contact: "34600500500", name: contact, text: "¿Cuánto cuesta el drenaje linfático?" });
    const message = await waitForTriage(request, contact);
    const detail = (await (await request.get(`/api/messages/${message.id}`)).json()).message;
    expect(detail.draft.text).toContain("45 €");
    expect(detail.draft.text).not.toContain("40 €");
  });

  test("AC-06 un documento eliminado tras confirmar deja de aparecer y no se cita", async ({ page, request }) => {
    const doc = await uploadDocument(request, `${unique("Aparcamiento")}.txt`, "Aparcamiento gratuito para pacientes en la planta -1.", "otros");
    await page.goto("/documentos");
    await page.getByRole("listitem").filter({ hasText: doc.name }).getByRole("button", { name: "Eliminar" }).click();
    await page.getByRole("button", { name: "Eliminar documento" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: doc.name })).toHaveCount(0);

    const contact = unique("Paciente AC06");
    await simulate(request, { channel: "whatsapp", contact: "34600600600", name: contact, text: "¿Hay aparcamiento gratuito?" });
    const message = await waitForTriage(request, contact);
    const detail = (await (await request.get(`/api/messages/${message.id}`)).json()).message;
    expect(detail.draft.citations.map((c: { documentName: string }) => c.documentName)).not.toContain(doc.name);
  });
});
