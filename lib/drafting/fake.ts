import { CLINICAL_MARKER, NO_INFORMATION_MARKER, type DraftModel, type DraftRequest, type DraftResult } from "./model";

export const FAKE_FAILURE_TRIGGER = "#fallo-de-prueba";
export const FAKE_INVENTED_FIGURE_TRIGGER = "#cifra-inventada";

const CLINICAL_WORDS = /\b(duele|dolor|molestia|lesi[oó]n|ejercicios?|tratamiento|diagn[oó]stico|s[ií]ntomas?|hurts?|pain)\b/i;
const STOPWORDS = new Set(
  "de la el los las un una y o a en que por para con del al se me mi tu su es lo le si no hay como cuanto cuánto cual cuál qué que tenéis teneis tienen vuestro vuestra".split(" "),
);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function stem(word: string): string {
  // "session" and "sesión" meet at "sesion": collapse doubled letters, drop plurals.
  return word.replace(/(.)\1/g, "$1").replace(/(es|s)$/, "");
}

/**
 * Deterministic stand-in for Claude used by tests and end-to-end runs
 * (DRAFT_MODEL=fake): it answers with the document line that shares most
 * words with the question and cites it, or escalates like the real prompt asks.
 */
export class FakeDraftModel implements DraftModel {
  readonly name = "fake";

  async draft(request: DraftRequest): Promise<DraftResult> {
    const body = request.message.body;
    // Test triggers for acceptance runs: a failing call and an answer with an invented figure.
    if (body.includes(FAKE_FAILURE_TRIGGER)) throw new Error("Fallo simulado del modelo");
    if (CLINICAL_WORDS.test(body)) return this.escalate(CLINICAL_MARKER);

    const asked = new Set(words(`${request.message.subject ?? ""} ${body}`).map(stem));
    let best: { sourceIndex: number; line: string; start: number; score: number } | null = null;

    request.sources.forEach((source, sourceIndex) => {
      let offset = 0;
      for (const line of source.text.split("\n")) {
        const score = words(line).filter((w) => asked.has(stem(w))).length;
        if (line.trim() && score > 0 && (!best || score > best.score)) {
          best = { sourceIndex, line: line.trim(), start: offset + line.indexOf(line.trim()), score };
        }
        offset += line.length + 1;
      }
    });

    if (!best) return this.escalate(NO_INFORMATION_MARKER);
    const { sourceIndex, line, start } = best as { sourceIndex: number; line: string; start: number };
    const source = request.sources[sourceIndex];
    const english = /\b(how|what|when|much|price|open)\b/i.test(body);
    const invented = body.includes(FAKE_INVENTED_FIGURE_TRIGGER) ? " Con descuento, 99 €." : "";
    return {
      text: `${english ? "According to our information" : "Según nuestra información"}: ${line}${invented}`,
      citations: [
        { documentId: source.documentId, documentName: source.name, category: source.category, citedText: line, start, end: start + line.length },
      ],
      escalation: null,
      refused: false,
      model: this.name,
    };
  }

  private escalate(marker: string): DraftResult {
    return {
      text: "",
      citations: [],
      escalation: marker === CLINICAL_MARKER ? "clinical" : "no_information",
      refused: false,
      model: this.name,
    };
  }
}
