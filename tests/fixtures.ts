import JSZip from "jszip";

/** WinAnsi encoding for the characters our fixtures use (€ is 0x80). */
function winAnsi(text: string): Buffer {
  const escaped = text.replace(/[\\()]/g, (c) => `\\${c}`).replace(/€/g, "\x80");
  return Buffer.from(escaped, "latin1");
}

/**
 * Builds a minimal one-page PDF. With `lines` it draws them as real text;
 * with `null` the page only has a drawn line, like a scan without OCR.
 */
export function makePdf(lines: string[] | null): Uint8Array {
  const content = lines
    ? Buffer.concat([
        Buffer.from("BT /F1 12 Tf 72 770 Td 16 TL\n"),
        ...lines.map((line) => Buffer.concat([Buffer.from("("), winAnsi(line), Buffer.from(") Tj T*\n")])),
        Buffer.from("ET"),
      ])
    : Buffer.from("72 700 m 400 700 l S");

  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    ),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from("\nendstream")]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
  ];

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [];
  let length = parts[0].length;
  objects.forEach((body, i) => {
    offsets.push(length);
    const obj = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from("\nendobj\n")]);
    parts.push(obj);
    length += obj.length;
  });
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(length),
    "%%EOF",
  ].join("\n");
  parts.push(Buffer.from(xref));
  return new Uint8Array(Buffer.concat(parts));
}

/** Builds a minimal DOCX with one paragraph per entry. */
export async function makeDocx(paragraphs: string[]): Promise<Uint8Array> {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
      .map((p) => `<w:p><w:r><w:t xml:space="preserve">${escape(p)}</w:t></w:r></w:p>`)
      .join("")}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}

export const TARIFAS_40 = "Tarifas 2026\n\nSesión de fisioterapia: 40 €\nBono de 5 sesiones: 180 €\n\nPrimera visita con valoración: 50 €";
export const TARIFAS_45 = "Tarifas 2026\n\nSesión de fisioterapia: 45 €\nBono de 5 sesiones: 200 €\n\nPrimera visita con valoración: 55 €";

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
