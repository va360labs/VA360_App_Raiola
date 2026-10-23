import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { describe, expect, it, vi } from "vitest";
import { AnthropicDraftModel, buildContent, configuredModel, DEFAULT_MODEL, readResponse, toBlocks } from "@/lib/drafting/anthropic";
import { FakeDraftModel } from "@/lib/drafting/fake";
import { extractFigures, unsupportedFigures } from "@/lib/drafting/figures";
import { CLINICAL_MARKER, DraftModelUnavailableError, NO_INFORMATION_MARKER, type DraftRequest, type Source } from "@/lib/drafting/model";
import { messageText, systemPrompt } from "@/lib/drafting/prompt";

const tarifas: Source = {
  documentId: 7,
  name: "Tarifas 2026.txt",
  category: "tarifas",
  text: "Tarifas 2026\n\nSesión de fisioterapia: 40 €\nBono de 5 sesiones: 180 €",
};
const horarios: Source = {
  documentId: 8,
  name: "Horarios.md",
  category: "horarios",
  text: "Lunes a viernes de 9:00 a 20:00\nSábados de 10 a 14 h",
};

function request(body: string, overrides: Partial<DraftRequest> = {}): DraftRequest {
  return {
    sources: [tarifas, horarios],
    history: [],
    message: { channel: "whatsapp", subject: null, body },
    clinicName: "Fisio Centro",
    ...overrides,
  };
}

function apiMessage(content: unknown[], stopReason = "end_turn"): BetaMessage {
  return { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content, stop_reason: stopReason } as unknown as BetaMessage;
}

describe("figure check", () => {
  it("finds prices, times, dates, percentages and larger numbers", () => {
    const labels = extractFigures("Cuesta 40 €, abrimos a las 9:00 y a las 10 h, el 24/12 cerramos, 10 % de descuento, 2 sesiones, plazo de 24 horas").map((f) => f.label);
    expect(labels).toEqual(["9:00", "10 h", "24 horas", "24/12", "40 €", "10 %"]);
  });

  it("accepts figures written differently from the document", () => {
    expect(unsupportedFigures("La sesión cuesta 40 €.", ["Sesión de fisioterapia: 40,00 €"])).toEqual([]);
    expect(unsupportedFigures("Abrimos a las 09:00 y cerramos a las 14:00.", ["de 9 a 14 h"])).toEqual([]);
    expect(unsupportedFigures("El bono cuesta 1.250 €", ["Bono anual: 1250 €"])).toEqual([]);
    expect(unsupportedFigures("Con 24 horas de antelación", ["cancelar con 24 h de antelación"])).toEqual([]);
  });

  it("flags any figure that the cited text does not contain", () => {
    expect(unsupportedFigures("La sesión cuesta 45 €.", ["Sesión de fisioterapia: 40 €"])).toEqual(["45 €"]);
    expect(unsupportedFigures("Abrimos a las 8:30.", ["Lunes a viernes de 9:00 a 20:00"])).toEqual(["8:30"]);
    expect(unsupportedFigures("Llámanos al 910 000 000.", ["Sesión: 40 €"])).toEqual(["910"]);
    expect(unsupportedFigures("Tienes un 15 % de descuento", [])).toEqual(["15 %"]);
  });

  it("ignores small counts without a unit and invalid times", () => {
    expect(unsupportedFigures("Puedes venir 2 veces por semana, a las 25:70 no.", ["texto"])).toEqual(["25", "70"]);
    expect(unsupportedFigures("Son 3 sesiones", ["texto"])).toEqual([]);
  });
});

describe("prompt", () => {
  it("states the rules and the escalation markers", () => {
    const prompt = systemPrompt("Fisio Centro");
    expect(prompt).toContain("Fisio Centro");
    expect(prompt).toContain(NO_INFORMATION_MARKER);
    expect(prompt).toContain(CLINICAL_MARKER);
    expect(prompt).toContain("mismo idioma");
  });

  it("puts the recent history before the new message", () => {
    const text = messageText(
      request("¿Y el bono?", {
        history: [
          { from: "patient", text: "¿Cuánto cuesta una sesión?" },
          { from: "clinic", text: "40 €" },
        ],
        message: { channel: "email", subject: "Precios", body: "¿Y el bono?" },
      }),
    );
    expect(text).toMatch(/Paciente: ¿Cuánto cuesta una sesión\?\nClínica: 40 €\n\nNuevo mensaje del paciente \(email\):\nAsunto: Precios\n¿Y el bono\?/);
    expect(messageText(request("hola"))).not.toContain("Conversación reciente");
  });
});

describe("Claude request and response", () => {
  it("sends each document with citations on and caches up to the last one", () => {
    const content = buildContent(request("hola"));
    expect(content).toHaveLength(3);
    expect(content[0]).toEqual({
      type: "document",
      source: {
        type: "content",
        content: [
          { type: "text", text: "Tarifas 2026" },
          { type: "text", text: "Sesión de fisioterapia: 40 €" },
          { type: "text", text: "Bono de 5 sesiones: 180 €" },
        ],
      },
      title: "Tarifas 2026.txt",
      context: "Categoría: tarifas",
      citations: { enabled: true },
    });
    expect(content[1]).toMatchObject({ title: "Horarios.md", cache_control: { type: "ephemeral" } });
    expect(content[2]).toMatchObject({ type: "text" });
  });

  it("joins the text and maps citations to the clinic documents", () => {
    const result = readResponse(
      apiMessage([
        { type: "thinking", thinking: "", signature: "x" },
        { type: "text", text: "La sesión cuesta ", citations: null },
        {
          type: "text",
          text: "40 €",
          citations: [
            { type: "char_location", cited_text: "Sesión de fisioterapia: 40 €", document_index: 0, document_title: "Tarifas 2026.txt", start_char_index: 14, end_char_index: 42, file_id: null },
            { type: "char_location", cited_text: "fantasma", document_index: 9, document_title: null, start_char_index: 0, end_char_index: 1, file_id: null },
            { type: "page_location", cited_text: "pdf", document_index: 0, document_title: null, start_page_number: 1, end_page_number: 1 },
          ],
        },
        { type: "text", text: "." },
      ]),
      [tarifas],
    );
    expect(result).toEqual({
      text: "La sesión cuesta 40 €.",
      citations: [{ documentId: 7, documentName: "Tarifas 2026.txt", category: "tarifas", citedText: "Sesión de fisioterapia: 40 €", start: 14, end: 42 }],
      escalation: null,
      refused: false,
      model: "claude-opus-5-5",
    });
  });

  it("points line citations at the exact line and drops repeated ones", () => {
    expect(toBlocks("  Tarifas \n\nSesión: 40 €\n")).toEqual([
      { text: "Tarifas", start: 2, end: 9 },
      { text: "Sesión: 40 €", start: 12, end: 24 },
    ]);
    const line = { type: "content_block_location", cited_text: "Sesión de fisioterapia: 40 €", document_index: 0, document_title: "Tarifas 2026.txt", start_block_index: 1, end_block_index: 2, file_id: null };
    const result = readResponse(
      apiMessage([
        { type: "text", text: "Cuesta 40 €", citations: [line, line] },
        { type: "text", text: " y el bono 180 €.", citations: [{ ...line, start_block_index: 1, end_block_index: 3 }, { ...line, start_block_index: 7, end_block_index: 8 }] },
      ]),
      [tarifas],
    );
    expect(result.citations).toEqual([
      { documentId: 7, documentName: "Tarifas 2026.txt", category: "tarifas", citedText: "Sesión de fisioterapia: 40 €", start: 14, end: 42 },
      { documentId: 7, documentName: "Tarifas 2026.txt", category: "tarifas", citedText: "Sesión de fisioterapia: 40 €\nBono de 5 sesiones: 180 €", start: 14, end: 68 },
    ]);
  });

  it("removes stray punctuation at the start of the answer", () => {
    expect(readResponse(apiMessage([{ type: "text", text: ":  " }, { type: "text", text: "The first visit costs €50." }]), [tarifas]).text).toBe(
      "The first visit costs €50.",
    );
  });

  it("recognises the escalation markers and refusals", () => {
    expect(readResponse(apiMessage([{ type: "text", text: NO_INFORMATION_MARKER }]), [tarifas]).escalation).toBe("no_information");
    const clinical = readResponse(apiMessage([{ type: "text", text: ` ${CLINICAL_MARKER}\n` }]), [tarifas]);
    expect(clinical).toMatchObject({ escalation: "clinical", text: "", citations: [] });
    expect(readResponse(apiMessage([], "refusal"), [tarifas]).refused).toBe(true);
  });

  it("calls the Messages API with the documents, effort and refusal fallback", async () => {
    const create = vi.fn().mockResolvedValue(apiMessage([{ type: "text", text: NO_INFORMATION_MARKER }]));
    const client = { beta: { messages: { create } } } as unknown as Anthropic;
    const model = new AnthropicDraftModel({ client });
    await model.draft(request("¿Tenéis parking?"));

    const params = create.mock.calls[0][0];
    expect(params).toMatchObject({
      model: DEFAULT_MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    expect(params.system).toContain("Fisio Centro");
    expect(params.messages[0].content).toHaveLength(3);
  });

  it("uses ANTHROPIC_MODEL when set and needs an API key", () => {
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-5-5");
    expect(configuredModel()).toBe("claude-sonnet-5-5");
    vi.stubEnv("ANTHROPIC_MODEL", "");
    expect(configuredModel()).toBe(DEFAULT_MODEL);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => new AnthropicDraftModel()).toThrow(DraftModelUnavailableError);
    expect(new AnthropicDraftModel({ apiKey: "clave-de-prueba" }).name).toBe(DEFAULT_MODEL);
    vi.unstubAllEnvs();
  });
});

describe("fake model", () => {
  const fake = new FakeDraftModel();

  it("answers with the matching document line and cites it", async () => {
    const result = await fake.draft(request("¿Cuánto cuesta una sesión?"));
    expect(result.text).toBe("Según nuestra información: Sesión de fisioterapia: 40 €");
    expect(result.citations[0]).toMatchObject({ documentId: 7, citedText: "Sesión de fisioterapia: 40 €", start: 14, end: 42 });
    expect(tarifas.text.slice(14, 42)).toBe("Sesión de fisioterapia: 40 €");
  });

  it("answers in English to English messages", async () => {
    const result = await fake.draft(request("How much is a session?"));
    expect(result.text.startsWith("According to our information")).toBe(true);
  });

  it("has triggers for a failing call and an invented figure", async () => {
    await expect(fake.draft(request("¿Cuánto cuesta una sesión? #fallo-de-prueba"))).rejects.toThrow();
    expect((await fake.draft(request("¿Cuánto cuesta una sesión? #cifra-inventada"))).text).toContain("99 €");
  });

  it("escalates clinical and uncovered questions", async () => {
    expect((await fake.draft(request("Me duele la rodilla, ¿qué ejercicios hago?"))).escalation).toBe("clinical");
    expect((await fake.draft(request("¿Tenéis parking?"))).escalation).toBe("no_information");
  });
});
