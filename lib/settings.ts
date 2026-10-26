import { getDb } from "@/lib/db";

export type SettingKey = "auto_send" | "ack_message" | "clinic_name" | "demo_loaded";

export function getSetting(key: SettingKey): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export function setSetting(key: SettingKey, value: string): void {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

/** Name shown in the panel; falls back to a neutral label. */
export function clinicDisplayName(): string {
  return getSetting("clinic_name").trim() || "Respuestas de la clínica";
}

export function countNeedsReview(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM messages WHERE status = 'needs_review'").get() as {
    n: number;
  };
  return row.n;
}
