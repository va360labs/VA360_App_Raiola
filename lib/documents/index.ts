import fs from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/config";
import { getDb } from "@/lib/db";
import { isCategory, MAX_DOCUMENT_BYTES, type Category, type DocumentStatus } from "./categories";
import { chunkText } from "./chunk";
import { detectFormat, extractText, hasUsableText } from "./extract";

export { CATEGORIES, isCategory, MAX_DOCUMENT_BYTES, type Category, type DocumentStatus } from "./categories";

export interface DocumentSummary {
  id: number;
  name: string;
  category: Category;
  mime: string;
  size: number;
  status: DocumentStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReadyDocument {
  id: number;
  name: string;
  category: Category;
  text: string;
  version: number;
}

export type DocumentErrorCode = "invalid_format" | "too_large" | "empty_file" | "invalid_category" | "not_found";

export class DocumentError extends Error {
  constructor(
    public readonly code: DocumentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DocumentError";
  }
}

export interface UploadInput {
  name: string;
  bytes: Uint8Array;
  category?: string;
}

/** Rejects unsupported formats, empty files, files over 10 MB and unknown categories. */
export function validateUpload(input: UploadInput, { categoryRequired }: { categoryRequired: boolean }) {
  const detected = detectFormat(input.name);
  if (!detected) {
    throw new DocumentError("invalid_format", "Formato no admitido. Sube un PDF, DOCX, TXT o Markdown.");
  }
  if (input.bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new DocumentError("too_large", "El archivo supera el máximo de 10 MB.");
  }
  if (input.bytes.byteLength === 0) {
    throw new DocumentError("empty_file", "El archivo está vacío.");
  }
  if (input.category !== undefined || categoryRequired) {
    if (!isCategory(input.category)) {
      throw new DocumentError("invalid_category", "Elige una categoría para el documento.");
    }
  }
  return detected;
}

interface DocumentRow {
  id: number;
  name: string;
  category: Category;
  mime: string;
  size: number;
  status: DocumentStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

function toSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    mime: row.mime,
    size: row.size,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SUMMARY_COLUMNS = "id, name, category, mime, size, status, version, created_at, updated_at";

export function listDocuments(category?: Category): DocumentSummary[] {
  const db = getDb();
  const rows = category
    ? db.prepare(`SELECT ${SUMMARY_COLUMNS} FROM documents WHERE category = ? ORDER BY updated_at DESC, id DESC`).all(category)
    : db.prepare(`SELECT ${SUMMARY_COLUMNS} FROM documents ORDER BY updated_at DESC, id DESC`).all();
  return (rows as DocumentRow[]).map(toSummary);
}

export function getDocument(id: number): DocumentSummary | null {
  const row = getDb().prepare(`SELECT ${SUMMARY_COLUMNS} FROM documents WHERE id = ?`).get(id) as DocumentRow | undefined;
  return row ? toSummary(row) : null;
}

/** Documents whose text can be used to draft answers. */
export function getReadyDocuments(): ReadyDocument[] {
  return getDb()
    .prepare("SELECT id, name, category, text, version FROM documents WHERE status = 'ready' ORDER BY id")
    .all() as ReadyDocument[];
}

function documentDir(id: number): string {
  return path.join(dataDir(), "documents", String(id));
}

function storeOriginal(id: number, version: number, ext: string, bytes: Uint8Array): void {
  const dir = documentDir(id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `v${version}${ext}`), bytes);
}

/** Extracts the text and replaces the indexed fragments in one transaction. */
async function processDocument(id: number, bytes: Uint8Array, format: Parameters<typeof extractText>[1]) {
  let text = "";
  let status: DocumentStatus;
  try {
    text = await extractText(bytes, format);
    status = hasUsableText(text) ? "ready" : "no_text";
  } catch {
    status = "error";
  }

  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM chunks WHERE document_id = ?").run(id);
    if (status === "ready") {
      const insert = db.prepare("INSERT INTO chunks (document_id, position, text) VALUES (?, ?, ?)");
      chunkText(text).forEach((chunk, position) => insert.run(id, position, chunk));
    }
    db.prepare(
      "UPDATE documents SET status = ?, text = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    ).run(status, status === "ready" ? text : null, id);
  })();
}

export async function createDocument(input: UploadInput): Promise<DocumentSummary> {
  const detected = validateUpload(input, { categoryRequired: true });
  const result = getDb()
    .prepare("INSERT INTO documents (name, category, mime, size, status) VALUES (?, ?, ?, ?, 'processing')")
    .run(input.name, input.category, detected.mime, input.bytes.byteLength);
  const id = Number(result.lastInsertRowid);

  storeOriginal(id, 1, detected.ext, input.bytes);
  await processDocument(id, input.bytes, detected.format);
  return getDocument(id)!;
}

/** Uploads a new version of an existing document; answers drafted afterwards use only the new text. */
export async function replaceDocument(id: number, input: UploadInput): Promise<DocumentSummary> {
  const current = getDocument(id);
  if (!current) throw new DocumentError("not_found", "El documento no existe.");
  const detected = validateUpload(input, { categoryRequired: false });
  const category = input.category ?? current.category;
  const version = current.version + 1;

  getDb()
    .prepare(
      "UPDATE documents SET name = ?, category = ?, mime = ?, size = ?, version = ?, status = 'processing' WHERE id = ?",
    )
    .run(input.name, category, detected.mime, input.bytes.byteLength, version, id);

  storeOriginal(id, version, detected.ext, input.bytes);
  await processDocument(id, input.bytes, detected.format);
  return getDocument(id)!;
}

export function deleteDocument(id: number): void {
  const result = getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
  if (result.changes === 0) throw new DocumentError("not_found", "El documento no existe.");
  fs.rmSync(documentDir(id), { recursive: true, force: true });
}
