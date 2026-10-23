import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Directory for the SQLite database, uploaded documents and generated secrets. */
export function dataDir(): string {
  return path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
}

export interface Secrets {
  sessionSecret: string;
  whatsappVerifyToken: string;
  emailWebhookToken: string;
}

const GENERATED_KEYS = ["sessionSecret", "whatsappVerifyToken", "emailWebhookToken"] as const;

const ENV_OVERRIDES: Record<(typeof GENERATED_KEYS)[number], string> = {
  sessionSecret: "SESSION_SECRET",
  whatsappVerifyToken: "WHATSAPP_VERIFY_TOKEN",
  emailWebhookToken: "EMAIL_WEBHOOK_TOKEN",
};

let cachedSecrets: Secrets | null = null;

/**
 * Secrets used to sign sessions and to authenticate webhooks.
 * Values from the environment win; otherwise they are generated once and
 * persisted in `<DATA_DIR>/secrets.json` so they survive restarts.
 */
export function getSecrets(): Secrets {
  if (cachedSecrets) return cachedSecrets;

  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "secrets.json");

  const stored: Partial<Secrets> = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : {};

  let changed = false;
  for (const key of GENERATED_KEYS) {
    if (!stored[key]) {
      stored[key] = crypto.randomBytes(32).toString("base64url");
      changed = true;
    }
  }
  if (changed) {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(stored, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  const resolved = {} as Secrets;
  for (const key of GENERATED_KEYS) {
    resolved[key] = process.env[ENV_OVERRIDES[key]] || stored[key]!;
  }
  cachedSecrets = resolved;
  return resolved;
}

/** Admin access key; `null` when it has not been configured. */
export function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD;
  return value && value.length > 0 ? value : null;
}

/** Optional Meta app secret used to verify WhatsApp webhook signatures. */
export function whatsappAppSecret(): string | null {
  const value = process.env.WHATSAPP_APP_SECRET;
  return value && value.length > 0 ? value : null;
}

/** For tests: forget cached values so a new DATA_DIR or env is picked up. */
export function resetConfigCache(): void {
  cachedSecrets = null;
}
