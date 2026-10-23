import { expect, test as setup } from "@playwright/test";
import { E2E_ENV } from "./env";
import { uploadDocument } from "./helpers";

const TARIFAS = "Tarifas 2026\n\nSesión de fisioterapia (45 minutos): 40 €\nBono de 5 sesiones: 180 €\nPrimera visita con valoración: 50 €\n";
const HORARIOS = "# Horarios\n\nLunes a viernes: de 9:00 a 20:00 sin interrupción.\nSábados: de 10:00 a 14:00.\n";
const CANCELACION = "# Política de cancelación\n\nLas citas se pueden cancelar sin coste hasta 24 horas antes.\nCon menos de 24 horas de antelación se cobra el 50 % de la sesión.\n";

setup("AC-36 arranca con una base de datos vacía creada en el primer arranque", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  const login = await request.post("/api/auth/login", { data: { password: E2E_ENV.ADMIN_PASSWORD } });
  expect(login.status()).toBe(200);
  expect((await (await request.get("/api/documents")).json()).documents).toEqual([]);
  expect((await (await request.get("/api/messages")).json()).messages).toEqual([]);
  expect((await (await request.get("/api/settings")).json()).settings.autoSend).toBe(false);

  await uploadDocument(request, "Tarifas 2026.txt", TARIFAS, "tarifas");
  await uploadDocument(request, "Horarios.md", HORARIOS, "horarios");
  await uploadDocument(request, "Política de cancelación.md", CANCELACION, "politicas");
  await request.storageState({ path: "e2e/.auth/admin.json" });
});
