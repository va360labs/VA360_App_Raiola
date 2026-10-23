"use client";

import { useState } from "react";
import useSWR from "swr";
import { Mail, MessageCircle, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Conversation } from "@/lib/inbox/conversations";
import { CHANNEL_LABELS, STATUS_LABELS } from "@/lib/messages/status";

type Channel = "whatsapp" | "email";

const EXAMPLES = [
  "¿Cuánto cuesta una sesión de fisioterapia?",
  "¿Qué horario tenéis los sábados?",
  "Tengo cita mañana y no puedo ir, ¿cómo la cancelo?",
  "¿Tenéis parking?",
  "Me duele la rodilla al bajar escaleras, ¿qué ejercicios hago?",
];

const DEFAULT_CONTACT: Record<Channel, string> = { whatsapp: "+34 600 111 222", email: "paciente@ejemplo.es" };

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<{ conversations: Conversation[] }>);

const timeFormat = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function Simulator() {
  const { data, mutate } = useSWR("/api/simulator/conversations", fetcher, { refreshInterval: 3000 });
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [contact, setContact] = useState(DEFAULT_CONTACT.whatsapp);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const conversations = data?.conversations ?? [];
  const keyOf = (c: Conversation) => `${c.channel}:${c.address}`;
  const current = conversations.find((c) => keyOf(c) === selected) ?? conversations[0];

  function switchChannel(next: Channel) {
    setChannel(next);
    setContact(DEFAULT_CONTACT[next]);
    setError(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const response = await fetch("/api/simulator/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, contact, name: name || undefined, subject: channel === "email" ? subject || undefined : undefined, text }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "No se pudo enviar el mensaje simulado.");
        return;
      }
      setText("");
      setNotice(`Mensaje recibido por el webhook de ${CHANNEL_LABELS[channel]}.`);
      const address = channel === "whatsapp" ? contact.replace(/\D/g, "") : contact.trim().toLowerCase();
      setSelected(`${channel}:${address}`);
      await mutate();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader title="Simulador" />
      <div className="grid gap-5 px-4 py-5 lg:grid-cols-[380px_minmax(0,1fr)] lg:px-6">
        <section aria-labelledby="sim-form-title" className="rounded-panel border border-line bg-panel p-5">
          <h2 id="sim-form-title" className="text-lg font-semibold text-ink">
            Enviar un mensaje de prueba
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Entra por el mismo webhook que un mensaje real de WhatsApp o de correo.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Canal</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(["whatsapp", "email"] as Channel[]).map((value) => (
                  <label
                    key={value}
                    className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-control border text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-action ${
                      channel === value ? "border-action bg-action-subtle text-action-active" : "border-line-strong text-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name="channel"
                      value={value}
                      checked={channel === value}
                      onChange={() => switchChannel(value)}
                      className="sr-only"
                    />
                    {value === "whatsapp" ? <MessageCircle aria-hidden size={18} strokeWidth={1.5} /> : <Mail aria-hidden size={18} strokeWidth={1.5} />}
                    {CHANNEL_LABELS[value]}
                  </label>
                ))}
              </div>
            </fieldset>

            <Field id="sim-contact" label={channel === "whatsapp" ? "Teléfono" : "Email"}>
              <input
                id="sim-contact"
                type={channel === "whatsapp" ? "tel" : "email"}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field id="sim-name" label="Nombre (opcional)">
              <input id="sim-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>

            {channel === "email" && (
              <Field id="sim-subject" label="Asunto (opcional)">
                <input id="sim-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
              </Field>
            )}

            <Field id="sim-text" label="Mensaje">
              <textarea
                id="sim-text"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={`${inputClass} h-auto py-2.5`}
              />
            </Field>

            <div>
              <p className="text-sm text-ink-muted">Ejemplos:</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setText(example)}
                    className="min-h-11 rounded-control border border-line px-3 py-2 text-left text-sm text-ink hover:bg-calm"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="text-sm text-ink-muted">
                {notice}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending || text.trim() === ""}>
              {pending ? "Enviando…" : "Enviar mensaje de prueba"}
            </Button>
          </form>
        </section>

        <section aria-labelledby="sim-conv-title" className="min-w-0 rounded-panel border border-line bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 id="sim-conv-title" className="text-lg font-semibold text-ink">
              Conversaciones simuladas
            </h2>
            {conversations.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                Contacto
                <select
                  value={current ? keyOf(current) : ""}
                  onChange={(e) => setSelected(e.target.value)}
                  className="h-11 max-w-56 rounded-control border border-line-strong bg-panel px-3 text-sm text-ink"
                >
                  {conversations.map((c) => (
                    <option key={keyOf(c)} value={keyOf(c)}>
                      {c.name ? `${c.name} (${c.address})` : c.address}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {!current ? (
            <EmptyState Icon={MessagesSquare} title="Todavía no hay conversaciones">
              Envía un mensaje de prueba y aparecerá aquí, junto con las respuestas que se le envíen.
            </EmptyState>
          ) : (
            <div className="px-5 py-4">
              <p className="text-sm text-ink-muted">
                {CHANNEL_LABELS[current.channel]}, {current.name ? `${current.name}, ` : ""}
                <span className="tabular">{current.address}</span>
              </p>
              <ol className="mt-4 space-y-3" aria-live="polite">
                {current.items.map((item, index) => (
                  <li key={index} className={`flex ${item.direction === "out" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-panel px-4 py-3 text-sm sm:max-w-[70%] ${
                        item.direction === "out" ? "bg-action-subtle text-ink" : "border border-line bg-panel-raised text-ink"
                      }`}
                    >
                      {item.subject && <p className="font-semibold">{item.subject}</p>}
                      <p className="whitespace-pre-wrap">{item.text || "(sin texto)"}</p>
                      <p className="tabular mt-1.5 text-xs text-ink-muted">
                        {item.direction === "out" ? "Respuesta enviada" : "Paciente"}, {timeFormat.format(new Date(item.at))}
                        {item.status && `, ${STATUS_LABELS[item.status]}`}
                      </p>
                      {item.reviewReason && <p className="mt-1 text-xs text-review">{item.reviewReason}</p>}
                      {item.draft && <DraftPreview draft={item.draft} />}
                      {item.messageId !== null && item.reviewReason === "No se pudo generar el borrador" && (
                        <RetryButton messageId={item.messageId} onDone={() => mutate()} />
                      )}
                      {item.direction === "in" && (item.status === "new" || item.status === "drafting") && (
                        <p className="mt-2 text-xs text-ink-muted">Redactando borrador…</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/** Proposed answer with its sources; the full review screen arrives with the inbox. */
function DraftPreview({ draft }: { draft: NonNullable<Conversation["items"][number]["draft"]> }) {
  if (!draft.text) return null;
  return (
    <div className="mt-3 rounded-control border border-line bg-panel px-3 py-2.5">
      <p className="text-xs font-medium text-ink-muted">Borrador propuesto</p>
      <p className="mt-1 whitespace-pre-wrap text-ink">{draft.text}</p>
      {draft.citations.length > 0 && (
        <ol className="mt-2 space-y-1">
          {draft.citations.map((citation, index) => (
            <li key={index} className="text-xs text-ink-muted">
              <span className="tabular mr-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-action-subtle px-1 font-semibold text-action-active">
                {index + 1}
              </span>
              {citation.documentName}: <mark className="rounded-sm bg-action-subtle px-0.5 text-ink">{citation.citedText.trim()}</mark>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RetryButton({ messageId, onDone }: { messageId: number; onDone: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      className="mt-2"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch(`/api/messages/${messageId}/retry`, { method: "POST" }).catch(() => null);
        setPending(false);
        onDone();
      }}
    >
      {pending ? "Reintentando…" : "Reintentar"}
    </Button>
  );
}

const inputClass ="block h-11 w-full rounded-control border border-line-strong bg-panel px-3 text-base text-ink";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
