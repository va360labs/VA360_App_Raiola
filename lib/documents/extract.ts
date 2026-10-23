import path from "node:path";

export type DocumentFormat = "pdf" | "docx" | "txt" | "md";

const FORMATS: Record<string, { format: DocumentFormat; mime: string }> = {
  ".pdf": { format: "pdf", mime: "application/pdf" },
  ".docx": { format: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  ".txt": { format: "txt", mime: "text/plain" },
  ".md": { format: "md", mime: "text/markdown" },
  ".markdown": { format: "md", mime: "text/markdown" },
};

/** Detects the format from the file name; `null` when it is not supported. */
export function detectFormat(fileName: string): { format: DocumentFormat; mime: string; ext: string } | null {
  const ext = path.extname(fileName).toLowerCase();
  const match = FORMATS[ext];
  return match ? { ...match, ext } : null;
}

/** Collapses the whitespace noise left by PDF and DOCX extraction while keeping paragraphs. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A document is usable when it has some real words, not just stray symbols or page numbers. */
export function hasUsableText(text: string): boolean {
  return (text.match(/\p{L}/gu)?.length ?? 0) >= 10;
}

export async function extractText(bytes: Uint8Array, format: DocumentFormat): Promise<string> {
  switch (format) {
    case "txt":
    case "md":
      return normalizeText(new TextDecoder("utf-8").decode(bytes));
    case "pdf": {
      const { extractText: extractPdf, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractPdf(pdf, { mergePages: false });
      return normalizeText((text as string[]).join("\n\n"));
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return normalizeText(value);
    }
  }
}
