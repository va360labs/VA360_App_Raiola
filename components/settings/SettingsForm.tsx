"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface Settings {
  autoSend: boolean;
  ackMessage: string;
  clinicName: string;
}

async function save(update: Partial<Settings>): Promise<{ settings?: Settings; error?: string }> {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  }).catch(() => null);
  if (!response) return { error: "No se pudo conectar con el servidor." };
  return response.json();
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [autoSend, setAutoSend] = useState(initial.autoSend);
  const [ackMessage, setAckMessage] = useState(initial.ackMessage);
  const [clinicName, setClinicName] = useState(initial.clinicName);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function setAutoSendTo(value: boolean) {
    setPending(true);
    const result = await save({ autoSend: value });
    setPending(false);
    setConfirming(false);
    if (result.error || !result.settings) return setError(result.error ?? "No se pudo guardar.");
    setAutoSend(result.settings.autoSend);
    setError(null);
    setNotice(value ? "Envío automático activado." : "Envío automático desactivado. Todo pasará por revisión.");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await save({ ackMessage, clinicName });
    setPending(false);
    if (result.error || !result.settings) return setError(result.error ?? "No se pudo guardar.");
    setError(null);
    setNotice("Cambios guardados.");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[960px] space-y-5 px-4 py-5 lg:px-6">
      {notice && (
        <p role="status" className="rounded-control border border-line bg-panel px-4 py-3 text-sm text-ink">
          {notice}
        </p>
      )}

      <section aria-labelledby="auto-title" className="rounded-panel border border-line bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 id="auto-title" className="text-lg font-semibold text-ink">
              Envío automático
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {autoSend
                ? "Activado. Las respuestas respaldadas por los documentos se envían solas; lo dudoso sigue pasando por una persona y el paciente recibe el aviso de recepción."
                : "Desactivado. Ninguna respuesta sale sin que alguien la apruebe."}
            </p>
          </div>
          <Button
            variant={autoSend ? "secondary" : "primary"}
            disabled={pending}
            onClick={() => (autoSend ? setAutoSendTo(false) : setConfirming(true))}
          >
            {autoSend ? "Desactivar envío automático" : "Activar envío automático"}
          </Button>
        </div>
      </section>

      <form onSubmit={onSubmit} aria-labelledby="clinic-title" className="space-y-4 rounded-panel border border-line bg-panel p-5" noValidate>
        <h2 id="clinic-title" className="text-lg font-semibold text-ink">
          Datos de la clínica
        </h2>
        <div className="space-y-1.5">
          <label htmlFor="clinic-name" className="block text-sm font-medium text-ink">
            Nombre de la clínica
          </label>
          <input
            id="clinic-name"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            maxLength={80}
            className="block h-11 w-full rounded-control border border-line-strong bg-panel px-3 text-base text-ink"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ack-message" className="block text-sm font-medium text-ink">
            Aviso de recepción
          </label>
          <textarea
            id="ack-message"
            rows={3}
            value={ackMessage}
            onChange={(e) => setAckMessage(e.target.value)}
            maxLength={500}
            aria-describedby="ack-help"
            className="block w-full rounded-control border border-line-strong bg-panel px-3 py-2.5 text-base text-ink"
          />
          <p id="ack-help" className="text-sm text-ink-muted">
            Con el envío automático activado, se manda una sola vez a cada mensaje que necesita revisión.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            Guardar cambios
          </Button>
        </div>
      </form>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Activar envío automático">
        <div className="space-y-5 text-sm text-ink">
          <p>
            Las respuestas que estén respaldadas por los documentos y sin motivo de revisión se enviarán a los pacientes
            sin que nadie las apruebe. Las consultas clínicas y lo que no esté en los documentos seguirán pasando por una
            persona.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setAutoSendTo(true)} disabled={pending}>
              Activar envío automático
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
