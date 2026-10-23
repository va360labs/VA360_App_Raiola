/**
 * Versioned schema migrations. Kept as TypeScript strings so they are bundled
 * into the standalone server without copying extra files.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial schema",
    sql: `
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('tarifas','horarios','politicas','faq','otros')),
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('processing','ready','no_text','error')),
        text TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        text TEXT NOT NULL
      );
      CREATE INDEX chunks_document ON chunks(document_id);

      CREATE VIRTUAL TABLE chunks_fts USING fts5(
        text,
        content='chunks',
        content_rowid='id',
        tokenize='unicode61 remove_diacritics 2'
      );
      CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
      END;
      CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.id, old.text);
      END;

      CREATE TABLE contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
        external_id TEXT NOT NULL,
        name TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE (channel, external_id)
      );

      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
        direction TEXT NOT NULL CHECK (direction IN ('in','out')),
        external_id TEXT,
        subject TEXT,
        body TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','unsupported')),
        simulated INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'new'
          CHECK (status IN ('new','drafting','draft_ready','needs_review','sent','discarded')),
        previous_status TEXT,
        review_reason TEXT,
        received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE (channel, external_id)
      );
      CREATE INDEX messages_status ON messages(status);
      CREATE INDEX messages_contact ON messages(contact_id, received_at);

      CREATE TABLE drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        text TEXT NOT NULL DEFAULT '',
        citations TEXT NOT NULL DEFAULT '[]',
        grounded INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        model TEXT,
        latency_ms INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX drafts_message ON drafts(message_id);

      CREATE TABLE outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER REFERENCES messages(id),
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
        recipient TEXT NOT NULL,
        text TEXT NOT NULL,
        send_mode TEXT NOT NULL CHECK (send_mode IN ('approved','edited','manual','auto','ack')),
        simulated INTEGER NOT NULL DEFAULT 1,
        sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX outbox_contact ON outbox(contact_id, sent_at);

      CREATE TABLE jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        run_after TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX jobs_pending ON jobs(status, run_after);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO settings (key, value) VALUES
        ('auto_send', 'false'),
        ('ack_message', 'Hemos recibido tu mensaje. Una persona del equipo te responderá lo antes posible.'),
        ('clinic_name', '');

      CREATE TABLE login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        ts INTEGER NOT NULL
      );
      CREATE INDEX login_attempts_ip ON login_attempts(ip, ts);
    `,
  },
];
