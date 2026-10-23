import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { adminPassword, dataDir, getSecrets, resetConfigCache, whatsappAppSecret } from "@/lib/config";
import { useTempDataDir } from "../helpers";

describe("config", () => {
  const tempDir = useTempDataDir();

  it("uses DATA_DIR as the data directory", () => {
    expect(dataDir()).toBe(path.resolve(tempDir()));
  });

  it("falls back to ./data when DATA_DIR is not set", () => {
    vi.stubEnv("DATA_DIR", "");
    expect(dataDir()).toBe(path.join(process.cwd(), "data"));
  });

  it("generates secrets once and keeps them across restarts", () => {
    const first = getSecrets();
    expect(first.sessionSecret).toHaveLength(43);
    expect(first.whatsappVerifyToken).not.toBe(first.emailWebhookToken);

    const file = path.join(tempDir(), "secrets.json");
    expect(fs.existsSync(file)).toBe(true);

    resetConfigCache();
    expect(getSecrets()).toEqual(first);
  });

  it("prefers values from the environment", () => {
    vi.stubEnv("SESSION_SECRET", "from-env-session");
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "from-env-verify");
    vi.stubEnv("EMAIL_WEBHOOK_TOKEN", "from-env-email");
    expect(getSecrets()).toEqual({
      sessionSecret: "from-env-session",
      whatsappVerifyToken: "from-env-verify",
      emailWebhookToken: "from-env-email",
    });
  });

  it("returns the cached secrets without touching the disk again", () => {
    const first = getSecrets();
    fs.rmSync(path.join(tempDir(), "secrets.json"));
    expect(getSecrets()).toBe(first);
  });

  it("treats an empty admin key or app secret as not configured", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.stubEnv("WHATSAPP_APP_SECRET", "");
    expect(adminPassword()).toBeNull();
    expect(whatsappAppSecret()).toBeNull();

    vi.stubEnv("ADMIN_PASSWORD", "clave-de-prueba");
    vi.stubEnv("WHATSAPP_APP_SECRET", "secreto-de-prueba");
    expect(adminPassword()).toBe("clave-de-prueba");
    expect(whatsappAppSecret()).toBe("secreto-de-prueba");
  });
});
