import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import {
  createDocument,
  deleteDocument,
  DocumentError,
  getDocument,
  getReadyDocuments,
  listDocuments,
  MAX_DOCUMENT_BYTES,
  replaceDocument,
} from "@/lib/documents";
import { formatBytes, formatDateTime } from "@/lib/format";
import { makeDocx, makePdf, TARIFAS_40, TARIFAS_45, utf8 } from "../fixtures";
import { useTempDataDir } from "../helpers";

function ftsHits(term: string): number {
  return (getDb().prepare("SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ?").all(term) as unknown[]).length;
}

describe("documents", () => {
  const tempDir = useTempDataDir();

  it("stores an uploaded document, indexes it and marks it ready", async () => {
    const doc = await createDocument({ name: "Tarifas 2026.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    expect(doc).toMatchObject({ name: "Tarifas 2026.txt", category: "tarifas", status: "ready", version: 1, mime: "text/plain" });
    expect(fs.existsSync(path.join(tempDir(), "documents", String(doc.id), "v1.txt"))).toBe(true);
    expect(ftsHits('"40 €"') + ftsHits("sesion")).toBeGreaterThan(0);
    expect(getReadyDocuments()).toEqual([
      { id: doc.id, name: "Tarifas 2026.txt", category: "tarifas", text: TARIFAS_40, version: 1 },
    ]);
  });

  it("reads PDF and DOCX uploads", async () => {
    const pdf = await createDocument({ name: "horarios.pdf", bytes: makePdf(["Lunes a viernes de 9:00 a 20:00"]), category: "horarios" });
    const docx = await createDocument({ name: "faq.docx", bytes: await makeDocx(["¿Hay parking? No."]), category: "faq" });
    expect(pdf.status).toBe("ready");
    expect(docx.status).toBe("ready");
    expect(getReadyDocuments().map((d) => d.text)).toEqual(["Lunes a viernes de 9:00 a 20:00", "¿Hay parking? No."]);
  });

  it("keeps a PDF without text out of the answers", async () => {
    const doc = await createDocument({ name: "escaneo.pdf", bytes: makePdf(null), category: "politicas" });
    expect(doc.status).toBe("no_text");
    expect(getReadyDocuments()).toEqual([]);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM chunks").get()).toEqual({ n: 0 });
  });

  it("marks a damaged file as unreadable", async () => {
    const doc = await createDocument({ name: "roto.pdf", bytes: utf8("no es un pdf"), category: "otros" });
    expect(doc.status).toBe("error");
    expect(getReadyDocuments()).toEqual([]);
  });

  it("rejects other formats, empty files, files over 10 MB and missing categories", async () => {
    const cases: [Parameters<typeof createDocument>[0], string][] = [
      [{ name: "foto.jpg", bytes: utf8("x"), category: "otros" }, "invalid_format"],
      [{ name: "vacio.txt", bytes: new Uint8Array(0), category: "otros" }, "empty_file"],
      [{ name: "grande.txt", bytes: new Uint8Array(MAX_DOCUMENT_BYTES + 1), category: "otros" }, "too_large"],
      [{ name: "sin-categoria.txt", bytes: utf8("Texto suficiente para indexar") }, "invalid_category"],
      [{ name: "rara.txt", bytes: utf8("Texto suficiente para indexar"), category: "inventada" }, "invalid_category"],
    ];
    for (const [input, code] of cases) {
      await expect(createDocument(input)).rejects.toMatchObject({ code });
    }
    expect(listDocuments()).toEqual([]);
  });

  it("accepts a file of exactly 10 MB", async () => {
    const bytes = new Uint8Array(MAX_DOCUMENT_BYTES).fill(0x61);
    const doc = await createDocument({ name: "limite.txt", bytes, category: "otros" });
    expect(doc.size).toBe(MAX_DOCUMENT_BYTES);
  });

  it("lists the most recent first and filters by category", async () => {
    const a = await createDocument({ name: "a.txt", bytes: utf8("Horario de mañana y tarde"), category: "horarios" });
    const b = await createDocument({ name: "b.txt", bytes: utf8("Tarifa de la sesión básica"), category: "tarifas" });
    expect(listDocuments().map((d) => d.id)).toEqual([b.id, a.id]);
    expect(listDocuments("horarios").map((d) => d.name)).toEqual(["a.txt"]);
    expect(getDocument(9999)).toBeNull();
  });

  it("replaces a document so only the new data is used", async () => {
    const doc = await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    const updated = await replaceDocument(doc.id, { name: "Tarifas nuevas.txt", bytes: utf8(TARIFAS_45) });

    expect(updated).toMatchObject({ id: doc.id, name: "Tarifas nuevas.txt", category: "tarifas", version: 2, status: "ready" });
    const [ready] = getReadyDocuments();
    expect(ready.text).toContain("45 €");
    expect(ready.text).not.toContain("40 €");
    const chunkText = (getDb().prepare("SELECT text FROM chunks").all() as { text: string }[]).map((c) => c.text).join(" ");
    expect(chunkText).toContain("45 €");
    expect(chunkText).not.toContain("40 €");

    const dir = path.join(tempDir(), "documents", String(doc.id));
    expect(fs.readdirSync(dir)).toEqual(["v2.txt"]);
  });

  it("can change the category when replacing", async () => {
    const doc = await createDocument({ name: "x.txt", bytes: utf8("Política de cancelación"), category: "otros" });
    const updated = await replaceDocument(doc.id, { name: "x.md", bytes: utf8("Política de cancelación 24 h"), category: "politicas" });
    expect(updated.category).toBe("politicas");
    expect(updated.mime).toBe("text/markdown");
  });

  it("refuses to replace a document that does not exist or with an invalid file", async () => {
    await expect(replaceDocument(42, { name: "a.txt", bytes: utf8("texto") })).rejects.toBeInstanceOf(DocumentError);
    const doc = await createDocument({ name: "a.txt", bytes: utf8("Horario de mañana y tarde"), category: "horarios" });
    await expect(replaceDocument(doc.id, { name: "a.png", bytes: utf8("x") })).rejects.toMatchObject({ code: "invalid_format" });
    expect(getDocument(doc.id)?.version).toBe(1);
  });

  it("deletes a document with its fragments and file", async () => {
    const doc = await createDocument({ name: "Tarifas.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    deleteDocument(doc.id);
    expect(listDocuments()).toEqual([]);
    expect(getReadyDocuments()).toEqual([]);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM chunks").get()).toEqual({ n: 0 });
    expect(ftsHits("sesion")).toBe(0);
    expect(fs.existsSync(path.join(tempDir(), "documents", String(doc.id)))).toBe(false);
    expect(() => deleteDocument(doc.id)).toThrow(DocumentError);
  });
});

describe("formatting", () => {
  it("shows dates in the clinic time zone", () => {
    expect(formatDateTime("2026-10-23T16:30:00Z", "Europe/Madrid")).toMatch(/23 oct 2026, 18:30/);
    expect(formatDateTime("2026-01-15T09:05:00Z", "UTC")).toMatch(/15 ene 2026, 09:05/);
  });

  it("uses Europe/Madrid unless APP_TIMEZONE says otherwise", async () => {
    const { displayTimeZone } = await import("@/lib/format");
    expect(displayTimeZone()).toBe(process.env.APP_TIMEZONE || "Europe/Madrid");
  });

  it("shows sizes in B, KB and MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3,5 MB");
  });
});
