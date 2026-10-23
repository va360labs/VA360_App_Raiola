import { getDb } from "@/lib/db";

export const MAX_FAILURES = 5;
export const WINDOW_MS = 60_000;
export const LOCK_MS = 60_000;

/**
 * Milliseconds the IP must still wait before trying again (0 = allowed).
 * After MAX_FAILURES failed attempts inside WINDOW_MS, the IP waits LOCK_MS
 * counted from its last failure.
 */
export function loginLockRemaining(ip: string, nowMs: number = Date.now()): number {
  const rows = getDb()
    .prepare("SELECT ts FROM login_attempts WHERE ip = ? AND ts > ? ORDER BY ts DESC")
    .all(ip, nowMs - WINDOW_MS - LOCK_MS) as { ts: number }[];
  if (rows.length < MAX_FAILURES) return 0;

  const lastFailure = rows[0].ts;
  const windowStart = lastFailure - WINDOW_MS;
  const inWindow = rows.filter((row) => row.ts > windowStart).length;
  if (inWindow < MAX_FAILURES) return 0;

  return Math.max(0, lastFailure + LOCK_MS - nowMs);
}

export function recordLoginFailure(ip: string, nowMs: number = Date.now()): void {
  const db = getDb();
  db.prepare("INSERT INTO login_attempts (ip, ts) VALUES (?, ?)").run(ip, nowMs);
  db.prepare("DELETE FROM login_attempts WHERE ts < ?").run(nowMs - 24 * 60 * 60 * 1000);
}

export function clearLoginFailures(ip: string): void {
  getDb().prepare("DELETE FROM login_attempts WHERE ip = ?").run(ip);
}

/** Client IP as seen behind the Coolify proxy. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "local";
}
