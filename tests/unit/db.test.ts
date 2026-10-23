import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import { resetConfigCache } from "@/lib/config";
import { closeDb, dbPath, getDb, isDbHealthy, migrate } from "@/lib/db";
import { migrations } from "@/lib/db/migrations";
import { useTempDataDir } from "../helpers";

describe("database", () => {
  const tempDir = useTempDataDir();

  it("creates an empty database with every table on first use", () => {
    expect(fs.existsSync(path.join(tempDir(), "app.db"))).toBe(false);
    const db = getDb();
    expect(fs.existsSync(dbPath())).toBe(true);

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table')").all() as { name: string }[])
      .map((row) => row.name);
    for (const table of ["documents", "chunks", "contacts", "messages", "drafts", "outbox", "jobs", "settings", "login_attempts"]) {
      expect(tables).toContain(table);
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual({ n: 0 });
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
  });

  it("reuses the same connection", () => {
    expect(getDb()).toBe(getDb());
  });

  it("applies migrations only once", () => {
    const db = getDb();
    expect(migrate(db)).toEqual([]);
    const rows = db.prepare("SELECT version FROM schema_migrations").all();
    expect(rows).toHaveLength(migrations.length);
  });

  it("applies new migrations in version order", () => {
    const db = new Database(":memory:");
    const applied = migrate(db, [
      { version: 2, name: "second", sql: "CREATE TABLE b (id INTEGER);" },
      { version: 1, name: "first", sql: "CREATE TABLE a (id INTEGER);" },
    ]);
    expect(applied).toEqual([1, 2]);
    db.close();
  });

  it("seeds the default settings", () => {
    const rows = getDb().prepare("SELECT key, value FROM settings ORDER BY key").all();
    expect(rows).toEqual([
      { key: "ack_message", value: "Hemos recibido tu mensaje. Una persona del equipo te responderá lo antes posible." },
      { key: "auto_send", value: "false" },
      { key: "clinic_name", value: "" },
    ]);
  });

  it("indexes chunk text for full-text search without accents", () => {
    const db = getDb();
    const doc = db
      .prepare("INSERT INTO documents (name, category, mime, size, status, text) VALUES ('Tarifas', 'tarifas', 'text/plain', 10, 'ready', 'x')")
      .run();
    db.prepare("INSERT INTO chunks (document_id, position, text) VALUES (?, 0, 'Sesión de fisioterapia: 40 €')").run(
      doc.lastInsertRowid,
    );
    const hit = db.prepare("SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH 'sesion'").all();
    expect(hit).toHaveLength(1);

    db.prepare("DELETE FROM chunks").run();
    expect(db.prepare("SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH 'sesion'").all()).toHaveLength(0);
  });

  it("reports healthy when the database answers", () => {
    expect(isDbHealthy()).toBe(true);
  });

  it("reports unhealthy when the data directory cannot be used", () => {
    closeDb();
    const blocker = path.join(tempDir(), "not-a-directory");
    fs.writeFileSync(blocker, "x");
    vi.stubEnv("DATA_DIR", blocker);
    resetConfigCache();
    expect(isDbHealthy()).toBe(false);
  });
});
