import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlockParam, BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import {
  CLINICAL_MARKER,
  DraftModelUnavailableError,
  NO_INFORMATION_MARKER,
  type Citation,
  type DraftModel,
  type DraftRequest,
  type DraftResult,
  type Source,
} from "./model";
import { messageText, systemPrompt } from "./prompt";

export const DEFAULT_MODEL = "claude-opus-5-5";

export function configuredModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

export interface TextBlock {
  text: string;
  start: number;
  end: number;
}

/**
 * Each non-empty line becomes a citable block, so a citation points at the
 * exact line of the document (a price, a schedule) and not at the whole file.
 */
export function toBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) {
      const start = offset + line.indexOf(trimmed);
      blocks.push({ text: trimmed, start, end: start + trimmed.length });
    }
    offset += line.length + 1;
  }
  return blocks;
}

/** Documents first (cached), then the variable part of the request. */
export function buildContent(request: DraftRequest): BetaContentBlockParam[] {
  const documents: BetaContentBlockParam[] = request.sources.map((source, index) => ({
    type: "document",
    source: { type: "content", content: toBlocks(source.text).map((b) => ({ type: "text" as const, text: b.text })) },
    title: source.name,
    context: `Categoría: ${source.category}`,
    citations: { enabled: true },
    ...(index === request.sources.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
  return [...documents, { type: "text", text: messageText(request) }];
}

/** Joins the answer text and maps each citation back to the clinic document it came from. */
export function readResponse(response: BetaMessage, sources: Source[]): DraftResult {
  let text = "";
  const citations: Citation[] = [];
  const seen = new Set<string>();
  const blocksOf = new Map<number, TextBlock[]>();

  for (const block of response.content) {
    if (block.type !== "text") continue;
    text += block.text;
    for (const citation of block.citations ?? []) {
      if (citation.type !== "content_block_location" && citation.type !== "char_location") continue;
      const source = sources[citation.document_index];
      if (!source) continue;

      let range: { start: number; end: number } | null = null;
      if (citation.type === "content_block_location") {
        if (!blocksOf.has(citation.document_index)) blocksOf.set(citation.document_index, toBlocks(source.text));
        const blocks = blocksOf.get(citation.document_index)!;
        const first = blocks[citation.start_block_index];
        const last = blocks[citation.end_block_index - 1];
        if (first && last) range = { start: first.start, end: last.end };
      } else {
        range = { start: citation.start_char_index, end: citation.end_char_index };
      }
      if (!range) continue;

      const key = `${source.documentId}:${range.start}:${range.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push({
        documentId: source.documentId,
        documentName: source.name,
        category: source.category,
        citedText: source.text.slice(range.start, range.end),
        ...range,
      });
    }
  }
  // Joining cited blocks can leave stray punctuation at the start (": The first visit…").
  text = text.trim().replace(/^[:;,.\-–—\s]+/, "");

  const escalation = text.includes(CLINICAL_MARKER)
    ? ("clinical" as const)
    : text.includes(NO_INFORMATION_MARKER)
      ? ("no_information" as const)
      : null;

  return {
    text: escalation ? "" : text,
    citations: escalation ? [] : citations,
    escalation,
    refused: response.stop_reason === "refusal",
    model: response.model,
  };
}

/** Claude through the Messages API, with native citations and prompt caching on the documents. */
export class AnthropicDraftModel implements DraftModel {
  readonly name: string;
  private readonly client: Anthropic;

  constructor(options: { apiKey?: string; model?: string; client?: Anthropic } = {}) {
    this.name = options.model ?? configuredModel();
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!options.client && !apiKey) {
      throw new DraftModelUnavailableError("Falta la clave de Anthropic (ANTHROPIC_API_KEY).");
    }
    this.client = options.client ?? new Anthropic({ apiKey, timeout: 90_000, maxRetries: 2 });
  }

  async draft(request: DraftRequest): Promise<DraftResult> {
    const response = await this.client.beta.messages.create({
      model: this.name,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // If a safety classifier declines, the API retries on a suitable model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: systemPrompt(request.clinicName),
      messages: [{ role: "user", content: buildContent(request) }],
    });
    return readResponse(response, request.sources);
  }
}
