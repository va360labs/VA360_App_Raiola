"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Inbox, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ApprovalStats, InboxRow, InboxStatus } from "@/lib/messages";
import { CHANNEL_LABELS, STATUS_LABELS } from "@/lib/messages/status";
import { MessageDetail } from "./MessageDetail";
import { StatusChip } from "./StatusChip";

interface InboxResponse {
  messages: InboxRow[];
  needsReview: number;
  stats: ApprovalStats;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<InboxResponse>);

const STATUS_FILTERS: InboxStatus[] = ["new", "draft_ready", "needs_review", "sent", "discarded"];

const timeFormat = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

function shortTime(iso: string) {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString() ? timeFormat.format(date) : dayFormat.format(date);
}

export function InboxView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const channel = params.get("canal") ?? "";
  const status = params.get("estado") ?? "";
  const selected = Number(params.get("m")) || null;

  const query = new URLSearchParams();
  if (channel) query.set("channel", channel);
  if (status) query.set("status", status);
  const { data, mutate } = useSWR(`/api/messages?${query}`, fetcher, { refreshInterval: 5000 });

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const messages = data?.messages ?? [];
  const stats = data?.stats;

  return (
    <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col md:min-h-dvh lg:h-dvh lg:flex-row">
      <section
        aria-label="Mensajes"
        className={`flex min-h-0 flex-col border-line bg-panel lg:w-[400px] lg:shrink-0 lg:border-r ${selected ? "hidden lg:flex" : "flex"}`}
      >
        <div className="border-b border-line px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-2xl font-semibold text-ink">Bandeja</h1>
            <p className="tabular text-sm text-review" role="status">
              {data ? `${data.needsReview} por revisar` : ""}
            </p>
          </div>
          {stats && (
            <p className="tabular mt-1 text-xs text-ink-muted">
              {stats.percentUnchanged === null
                ? "Aún no hay respuestas revisadas en los últimos 7 días."
                : `Últimos 7 días: ${stats.percentUnchanged} % de las respuestas revisadas se aprobaron sin cambios (${stats.approvedUnchanged} de ${stats.reviewed}).`}
              {stats.autoSent > 0 && ` ${stats.autoSent} enviadas automáticamente.`}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-ink-muted">
              Canal
              <select
                value={channel}
                onChange={(e) => setParam("canal", e.target.value || null)}
                className="mt-1 block h-11 w-full rounded-control border border-line-strong bg-panel px-2 text-sm text-ink"
              >
                <option value="">Todos</option>
                <option value="whatsapp">{CHANNEL_LABELS.whatsapp}</option>
                <option value="email">{CHANNEL_LABELS.email}</option>
              </select>
            </label>
            <label className="text-xs text-ink-muted">
              Estado
              <select
                value={status}
                onChange={(e) => setParam("estado", e.target.value || null)}
                className="mt-1 block h-11 w-full rounded-control border border-line-strong bg-panel px-2 text-sm text-ink"
              >
                <option value="">Todos</option>
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {data && messages.length === 0 ? (
          <EmptyState Icon={Inbox} title={channel || status ? "Ningún mensaje con estos filtros" : "Todavía no hay mensajes"}>
            {channel || status ? (
              "Cambia el canal o el estado para ver más mensajes."
            ) : (
              <>
                Los mensajes de WhatsApp y email aparecerán aquí. Puedes enviar uno de prueba desde el{" "}
                <Link href="/simulador" className="text-action underline-offset-2 hover:underline">
                  simulador
                </Link>
                .
              </>
            )}
          </EmptyState>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {messages.map((m) => {
              const active = m.id === selected;
              const ChannelIcon = m.channel === "whatsapp" ? MessageCircle : Mail;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setParam("m", String(m.id))}
                    aria-current={active ? "true" : undefined}
                    className={`block w-full px-4 py-3 text-left ${active ? "bg-action-subtle" : "hover:bg-calm"}`}
                  >
                    <span className="flex items-center gap-2">
                      <ChannelIcon aria-label={CHANNEL_LABELS[m.channel]} size={16} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{m.contactName ?? m.contactAddress}</span>
                      <span className="tabular shrink-0 text-xs text-ink-muted">{shortTime(m.receivedAt)}</span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-ink-muted">
                      {m.subject ? `${m.subject}: ` : ""}
                      {m.excerpt || "(sin texto)"}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusChip status={m.status} sendMode={m.sendMode} />
                      {m.simulated && <span className="text-xs text-ink-subtle">Simulado</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Detalle del mensaje" className={`min-w-0 flex-1 lg:overflow-y-auto ${selected ? "block" : "hidden lg:block"}`}>
        {selected ? (
          <MessageDetail key={selected} id={selected} onBack={() => setParam("m", null)} onChanged={() => mutate()} />
        ) : (
          <EmptyState Icon={Inbox} title="Elige un mensaje">
            Al abrir un mensaje verás su conversación y la respuesta preparada con sus fuentes.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
