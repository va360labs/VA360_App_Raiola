import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { phone, simulate, unique, waitForTriage } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function audit(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
}

test.describe("Accesibilidad WCAG 2.1 AA (axe)", () => {
  test("Bandeja con un mensaje abierto", async ({ page, request }) => {
    const name = unique("Accesible");
    await simulate(request, { channel: "whatsapp", contact: phone(), name, text: "¿Cuánto cuesta una sesión?" });
    await waitForTriage(request, name);
    await page.goto("/bandeja");
    await page.getByRole("button").filter({ hasText: name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    expect(await audit(page)).toEqual([]);
  });

  for (const path of ["/documentos", "/simulador", "/ajustes"]) {
    test(`Pantalla ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await audit(page)).toEqual([]);
    });
  }

  test.describe("sin sesión", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test("Pantalla /login", async ({ page }) => {
      await page.goto("/login");
      expect(await audit(page)).toEqual([]);
    });
  });
});
