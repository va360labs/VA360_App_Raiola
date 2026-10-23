export const TARGET_CHUNK_CHARS = 1200;

/**
 * Splits a document into fragments of about TARGET_CHUNK_CHARS, cutting at
 * paragraph boundaries and, for very long paragraphs, at sentence boundaries.
 * Fragments feed the full-text index used when the documents do not fit in
 * the model context.
 */
export function chunkText(text: string, target: number = TARGET_CHUNK_CHARS): string[] {
  const pieces = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((paragraph) => (paragraph.length > target ? splitLong(paragraph, target) : [paragraph]));

  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length + 2 > target) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitLong(paragraph: string, target: number): string[] {
  const sentences = paragraph.match(/[^.!?\n]+(?:[.!?]+|$)\s*/g) ?? [paragraph];
  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > target) {
      if (current) out.push(current.trim());
      for (let i = 0; i < sentence.length; i += target) out.push(sentence.slice(i, i + target).trim());
      current = "";
    } else if (current.length + sentence.length > target) {
      out.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}
