import { getDb } from "@/lib/db";
import { getReadyDocuments } from "@/lib/documents";
import type { Category } from "@/lib/documents/categories";
import type { Source } from "./model";

/** Above this size (≈ chars / 4) the documents are not sent whole: only the best fragments. */
export const FULL_CONTEXT_TOKEN_LIMIT = 150_000;
export const MAX_FRAGMENTS = 20;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Full-text query from the message words, safe for FTS5 syntax. */
export function ftsQuery(message: string): string | null {
  const terms = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
  if (terms.length === 0) return null;
  return [...new Set(terms)].map((t) => `"${t}"*`).join(" OR ");
}

/**
 * What the model gets: every ready document when they fit, otherwise the
 * fragments that best match the message.
 */
export function selectSources(message: string, limit: number = FULL_CONTEXT_TOKEN_LIMIT): Source[] {
  const documents = getReadyDocuments();
  const total = documents.reduce((sum, d) => sum + estimateTokens(d.text), 0);
  if (total <= limit) {
    return documents.map((d) => ({ documentId: d.id, name: d.name, category: d.category, text: d.text }));
  }

  const query = ftsQuery(message);
  if (!query) return [];
  const rows = getDb()
    .prepare(
      `SELECT c.text, d.id AS documentId, d.name, d.category
         FROM chunks_fts f
         JOIN chunks c ON c.id = f.rowid
         JOIN documents d ON d.id = c.document_id
        WHERE chunks_fts MATCH ? AND d.status = 'ready'
        ORDER BY bm25(chunks_fts)
        LIMIT ?`,
    )
    .all(query, MAX_FRAGMENTS) as { text: string; documentId: number; name: string; category: Category }[];
  return rows.map((r) => ({ documentId: r.documentId, name: r.name, category: r.category, text: r.text }));
}
