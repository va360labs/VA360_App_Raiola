"use client";

import { useState } from "react";
import useSWR from "swr";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { CATEGORIES } from "@/lib/documents/categories";
import { unsupportedFigures } from "@/lib/drafting/figures";
import type { CitationView, MessageDetail as Detail } from "@/lib/messages";
import { CHANNEL_LABELS, SEND_MODE_LABELS } from "@/lib/messages/status";
import { StatusChip } from "./StatusChip";

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<{ message: Detail }>);
const dateTime = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function MessageDetail({ id, onBack, onChanged }: { id: number; onBack: () => void; onChanged: () => void }) {
  const { data, mutate } = useSWR(`/api/messages/${id}`, fetcher, { refreshInterval: 5000 });
  const message = data?.message;

  if (!message) {
    return <p className="px-6 py-10 text-sm text-ink-muted">Cargando el mensaje…</p>;
  }

  const refresh = async () => {
    await mutate();
    onChanged();
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-4 lg:px-6 lg:py-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex h-11 items-center gap-2 text-sm font-medium text-action lg:hidden"
      >
        <ArrowLeft aria-hidden size={18} strokeWidth={1.5} />
        Volver a la bandeja
      </button>

      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-ink">{message.contactName ?? message.contactAddress}</h2>
          <p className="tabular mt-0.5 text-sm text-ink-muted">
            {CHANNEL_LABELS[message.channel]}, {message.contactAddress}
            {message.simulated && ", simulado"}
          </p>
          {message.subject && <p className="mt-1 text-sm text-ink">Asunto: {message.subject}</p>}
        </div>
        <StatusChip status={message.status} sendMode={message.sendMode} />
      </header>

      <section aria-label="Conversación" className="mt-4">
        <ol className="space-y-3">
          {message.thread.map((item, index) => {
            const current = item.direction === "in" && item.messageId === message.id;
            return (
              <li key={index} className={`flex ${item.direction === "out" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-panel px-4 py-3 text-sm sm:max-w-[75%] ${
                    item.direction === "out"
                      ? "bg-action-subtle text-ink"
                      : current
                        ? "border border-line-strong bg-panel text-ink"
                        : "border border-line bg-panel-raised text-ink"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{item.text || "(sin texto)"}</p>
                  <p className="tabular mt-1.5 text-xs text-ink-muted">
                    {item.direction === "out" ? (item.sendMode ? SEND_MODE_LABELS[item.sendMode] : "Respuesta") : "Paciente"},{" "}
                    {dateTime.format(new Date(item.at))}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {message.status === "needs_review" && message.reviewReason && (
        <ReviewReason reason={message.reviewReason} messageId={message.id} onRetried={refresh} />
      )}

      {message.reply ? (
        <section aria-label="Respuesta enviada" className="mt-6 rounded-panel border border-line bg-panel p-4">
          <h3 className="text-sm font-semibold text-ink">Respuesta enviada</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{message.reply.text}</p>
          <p className="tabular mt-2 text-xs text-ink-muted">
            {SEND_MODE_LABELS[message.reply.mode]}, {dateTime.format(new Date(message.reply.sentAt))}
          </p>
        </section>
      ) : message.status === "discarded" ? (
        <DiscardedActions id={message.id} onDone={refresh} />
      ) : message.status === "new" ? (
        <p className="mt-6 text-sm text-ink-muted">Redactando la respuesta con los documentos de la clínica…</p>
      ) : (
        <ReplyEditor key={`${message.id}-${message.draft?.createdAt ?? "none"}`} message={message} onDone={refresh} />
      )}
    </article>
  );
}

function ReviewReason({ reason, messageId, onRetried }: { reason: string; messageId: number; onRetried: () => void }) {
  const [pending, setPending] = useState(false);
  const canRetry = reason === "No se pudo generar el borrador";
  return (
    <div role="note" className="mt-5 flex flex-wrap items-start gap-3 rounded-panel bg-review-subtle px-4 py-3 text-sm text-review">
      <AlertTriangle aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Requiere revisión: {reason}</p>
        <p className="mt-0.5 text-ink">
          {reason === "Consulta clínica"
            ? "Las consultas clínicas las responde siempre un profesional."
            : reason === "Dato no encontrado en los documentos"
              ? "El borrador incluye algún dato que no aparece en los documentos citados. Revísalo antes de enviarlo."
              : canRetry
                ? "No se ha podido preparar la respuesta. Puedes reintentarlo o escribirla a mano."
                : "Escribe la respuesta a mano o descarta el mensaje."}
        </p>
      </div>
      {canRetry && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await fetch(`/api/messages/${messageId}/retry`, { method: "POST" }).catch(() => null);
            setPending(false);
            onRetried();
          }}
        >
          {pending ? "Reintentando…" : "Reintentar"}
        </Button>
      )}
    </div>
  );
}

function ReplyEditor({ message, onDone }: { message: Detail; onDone: () => void }) {
  const draft = message.draft;
  const [text, setText] = useState(draft?.text ?? "");
  const [pending, setPending] = useState<"send" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openCitation, setOpenCitation] = useState<number | null>(null);

  const citations = draft?.citations ?? [];
  const missing = draft?.text ? unsupportedFigures(text, citations.map((c) => c.citedText)) : [];
  const fromScratch = !draft?.text;

  async function act(action: "send" | "discard") {
    setPending(action);
    setError(null);
    const response = await fetch(`/api/messages/${message.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "send" ? JSON.stringify({ text }) : undefined,
    }).catch(() => null);
    setPending(null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(body?.error ?? "No se pudo completar la acción.");
      return;
    }
    onDone();
  }

  return (
    <section aria-labelledby="reply-title" className="mt-6">
      <h3 id="reply-title" className="text-sm font-semibold text-ink">
        {fromScratch ? "Escribe la respuesta" : "Respuesta propuesta"}
      </h3>
      <label htmlFor="reply-text" className="sr-only">
        Texto de la respuesta
      </label>
      <textarea
        id="reply-text"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={fromScratch ? "Escribe aquí la respuesta para el paciente" : undefined}
        className="mt-2 block w-full rounded-control border border-line-strong bg-panel px-3 py-2.5 text-base text-ink"
      />

      {missing.length > 0 && (
        <p className="mt-2 text-sm text-review">
          Datos sin respaldo en las fuentes citadas:{" "}
          {missing.map((figure, i) => (
            <span key={i} className="tabular underline decoration-review decoration-wavy underline-offset-4">
              {figure}
              {i < missing.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}

      {citations.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-muted">Fuentes</p>
          <ol className="mt-1.5 flex flex-wrap gap-2">
            {citations.map((citation, index) => (
              <li key={index} className="min-w-0 max-w-full">
                <button
                  type="button"
                  onClick={() => setOpenCitation(index)}
                  className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-control border border-line bg-panel px-3 py-1.5 text-left text-sm text-ink hover:bg-calm"
                >
                  <span className="tabular inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-action-subtle px-1 text-xs font-semibold text-action-active">
                    {index + 1}
                  </span>
                  <span className="truncate">
                    {citation.documentName}: {citation.citedText.split("\n")[0]}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="sticky bottom-16 mt-4 flex flex-col-reverse gap-3 bg-canvas py-2 sm:flex-row sm:justify-end md:bottom-0">
        <Button variant="ghost" onClick={() => act("discard")} disabled={pending !== null}>
          {pending === "discard" ? "Descartando…" : "Descartar sin responder"}
        </Button>
        <Button onClick={() => act("send")} disabled={pending !== null || !text.trim()}>
          {pending === "send" ? "Enviando…" : fromScratch ? "Enviar respuesta" : "Aprobar y enviar"}
        </Button>
      </div>

      <CitationDialog citation={openCitation === null ? null : citations[openCitation]} number={(openCitation ?? 0) + 1} onClose={() => setOpenCitation(null)} />
    </section>
  );
}

function CitationDialog({ citation, number, onClose }: { citation: CitationView | null; number: number; onClose: () => void }) {
  return (
    <Dialog open={citation !== null} onClose={onClose} title={citation ? `Fuente ${number}: ${citation.documentName}` : ""}>
      {citation && (
        <div className="space-y-3 text-sm">
          <p className="text-ink-muted">Categoría: {CATEGORIES[citation.category]}</p>
          {citation.context !== null ? (
            <p className="whitespace-pre-wrap rounded-control border border-line bg-panel-raised p-3 text-ink">
              {citation.context.slice(0, citation.highlightStart)}
              <mark className="rounded-sm bg-action-subtle px-0.5 text-ink">
                {citation.context.slice(citation.highlightStart, citation.highlightEnd)}
              </mark>
              {citation.context.slice(citation.highlightEnd)}
            </p>
          ) : (
            <>
              <p className="whitespace-pre-wrap rounded-control border border-line bg-panel-raised p-3 text-ink">
                <mark className="rounded-sm bg-action-subtle px-0.5 text-ink">{citation.citedText}</mark>
              </p>
              <p className="text-review">El documento ha cambiado o se ha eliminado desde que se redactó esta respuesta.</p>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

function DiscardedActions({ id, onDone }: { id: number; onDone: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-panel p-4">
      <p className="text-sm text-ink-muted">Descartado sin responder.</p>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await fetch(`/api/messages/${id}/reopen`, { method: "POST" }).catch(() => null);
          setPending(false);
          onDone();
        }}
      >
        {pending ? "Reabriendo…" : "Reabrir"}
      </Button>
    </div>
  );
}
