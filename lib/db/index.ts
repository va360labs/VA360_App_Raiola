import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { dataDir } from "@/lib/config";
import { migrations, type Migration } from "./migrations";

export type Db = Database.Database;

// Survive Next.js dev reloads without opening a new connection each time.
const globalForDb = globalThis as unknown as { __va360Db?: Db };

export function dbPath(): string {
  return path.join(dataDir(), "app.db");
}

/** Shared connection; creates the database and applies pending migrations on first use. */
export function getDb(): Db {
  if (globalForDb.__va360Db) return globalForDb.__va360Db;

  fs.mkdirSync(dataDir(), { recursive: true });
  const db = new Database(dbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);

  globalForDb.__va360Db = db;
  return db;
}

/** Applies every migration not yet recorded, each one in its own transaction. */
export function migrate(db: Db, list: Migration[] = migrations): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((row) => (row as { version: number }).version),
  );

  const newlyApplied: number[] = [];
  for (const migration of [...list].sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)").run(
        migration.version,
        migration.name,
      );
    })();
    newlyApplied.push(migration.version);
  }
  return newlyApplied;
}

/** True when the database answers a trivial query. */
export function isDbHealthy(): boolean {
  try {
    getDb().prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

/** For tests and graceful shutdown. */
export function closeDb(): void {
  globalForDb.__va360Db?.close();
  globalForDb.__va360Db = undefined;
}
