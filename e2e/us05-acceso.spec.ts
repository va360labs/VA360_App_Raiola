import { expect, request as playwrightRequest, test } from "@playwright/test";
import { E2E_ENV } from "./env";

test.describe("@US-05 @UC-501 Proteger el acceso al panel", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("AC-34 sin sesión, las pantallas llevan al inicio de sesión y la API responde 401, salvo webhooks y estado", async ({ page, request }) => {
    for (const path of ["/bandeja", "/documentos", "/simulador", "/ajustes"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    }
    for (const path of ["/api/messages", "/api/documents", "/api/settings", "/api/simulator/conversations"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
    }
    expect((await request.post("/api/simulator/send", { data: {} })).status()).toBe(401);
    expect((await request.get("/api/health")).status()).toBe(200);
    expect((await request.get("/api/webhooks/whatsapp")).status()).toBe(403);
    expect((await request.post("/api/webhooks/email", { data: {} })).status()).toBe(401);
  });

  test("AC-35 con la clave correcta se entra con una sesión de 7 días; con una incorrecta se ve un error", async ({ page, context }) => {
    await page.goto("/login?next=/documentos");
    await page.getByLabel("Clave de acceso").fill("clave-equivocada");
    await page.getByRole("button", { name: "Entrar al panel" }).click();
    await expect(page.locator("#login-error")).toHaveText("La clave no es correcta.");

    await page.getByLabel("Clave de acceso").fill(E2E_ENV.ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Entrar al panel" }).click();
    await expect(page).toHaveURL(/\/documentos$/);
    const session = (await context.cookies()).find((c) => c.name === "va360_session");
    expect(session?.httpOnly).toBe(true);
    const days = (session!.expires * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7.01);
  });

  test("AC-35 tras 5 intentos fallidos en un minuto hay que esperar 60 segundos", async ({ baseURL }) => {
    const ip = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": "198.51.100.77" } });
    for (let i = 0; i < 5; i++) {
      expect((await ip.post("/api/auth/login", { data: { password: "mal" } })).status()).toBe(401);
    }
    const locked = await ip.post("/api/auth/login", { data: { password: E2E_ENV.ADMIN_PASSWORD } });
    expect(locked.status()).toBe(429);
    expect(Number(locked.headers()["retry-after"])).toBeGreaterThan(55);
    await ip.dispose();
  });
});

test.describe("@US-05 @UC-502 Ejecutar en local y desplegar en un contenedor", () => {
  test("AC-38 la comprobación de estado responde 200 con status ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
