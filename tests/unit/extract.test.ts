import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/documents/chunk";
import { detectFormat, extractText, hasUsableText, normalizeText } from "@/lib/documents/extract";
import { makeDocx, makePdf, utf8 } from "../fixtures";

describe("format detection", () => {
  it("accepts PDF, DOCX, TXT and Markdown by extension, in any case", () => {
    expect(detectFormat("Tarifas.PDF")).toMatchObject({ format: "pdf", mime: "application/pdf", ext: ".pdf" });
    expect(detectFormat("horarios.docx")?.format).toBe("docx");
    expect(detectFormat("faq.txt")?.mime).toBe("text/plain");
    expect(detectFormat("politicas.md")?.format).toBe("md");
    expect(detectFormat("notas.markdown")?.format).toBe("md");
  });

  it("rejects anything else", () => {
    for (const name of ["foto.jpg", "hoja.xlsx", "antiguo.doc", "sin-extension"]) {
      expect(detectFormat(name)).toBeNull();
    }
  });
});

describe("text normalisation", () => {
  it("removes the BOM, unifies line breaks and collapses blank space", () => {
    expect(normalizeText("﻿Hola\r\n\r\n\r\n\r\nque\ttal  bien   \nfin  ")).toBe("Hola\n\nque tal bien\nfin");
  });

  it("only considers a document usable when it has real words", () => {
    expect(hasUsableText("1 2 3 4 5 6 7 8 9 10 ...")).toBe(false);
    expect(hasUsableText("Horario de lunes a viernes")).toBe(true);
  });
});

describe("extraction", () => {
  it("reads plain text and Markdown as UTF-8", async () => {
    expect(await extractText(utf8("﻿Sesión: 40 €"), "txt")).toBe("Sesión: 40 €");
    expect(await extractText(utf8("# Horarios\n\nLunes a viernes"), "md")).toBe("# Horarios\n\nLunes a viernes");
  });

  it("reads the text of a PDF, including accents and the euro sign", async () => {
    const text = await extractText(makePdf(["Sesión de fisioterapia: 40 €", "Cancelaciones con 24 h de antelación"]), "pdf");
    expect(text).toContain("Sesión de fisioterapia: 40 €");
    expect(text).toContain("Cancelaciones con 24 h de antelación");
  });

  it("gets no usable text from a PDF without text", async () => {
    const text = await extractText(makePdf(null), "pdf");
    expect(hasUsableText(text)).toBe(false);
  });

  it("fails on a damaged PDF", async () => {
    await expect(extractText(utf8("esto no es un pdf"), "pdf")).rejects.toThrow();
  });

  it("reads the paragraphs of a DOCX", async () => {
    const text = await extractText(await makeDocx(["Horario de verano", "Lunes a viernes de 8:00 a 15:00"]), "docx");
    expect(text).toContain("Horario de verano");
    expect(text).toContain("Lunes a viernes de 8:00 a 15:00");
  });
});

describe("chunking", () => {
  it("returns nothing for an empty text and one fragment for a short one", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("Sesión: 40 €")).toEqual(["Sesión: 40 €"]);
  });

  it("groups paragraphs without going over the target size", () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Párrafo ${i} ${"x".repeat(40)}`);
    const chunks = chunkText(paragraphs.join("\n\n"), 120);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(120);
    expect(chunks.join("\n\n")).toBe(paragraphs.join("\n\n"));
  });

  it("splits a long paragraph at sentence boundaries", () => {
    const sentence = "La sesión dura cuarenta y cinco minutos. ";
    const chunks = chunkText(sentence.repeat(6).trim(), 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
      expect(chunk.endsWith(".")).toBe(true);
    }
  });

  it("cuts a single sentence longer than the target into pieces", () => {
    const chunks = chunkText(`Corto. ${"a".repeat(250)}`, 100);
    expect(chunks[0]).toBe("Corto.");
    expect(chunks.slice(1).every((c) => c.length <= 100)).toBe(true);
    expect(chunks.slice(1).join("")).toBe("a".repeat(250));
  });
});
