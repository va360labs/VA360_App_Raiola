"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { CATEGORY_OPTIONS, MAX_UPLOAD_BYTES, type DocumentRow } from "./types";

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown";

export function UploadPanel({
  open,
  replacing,
  onClose,
  onDone,
}: {
  open: boolean;
  /** When set, the panel uploads a new version of this document. */
  replacing: DocumentRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const effectiveCategory = category || replacing?.category || "";

  function reset() {
    setFile(null);
    setCategory("");
    setError(null);
    setPending(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) return setError("Elige un archivo.");
    if (file.size > MAX_UPLOAD_BYTES) return setError("El archivo supera el máximo de 10 MB.");
    if (!effectiveCategory) return setError("Elige una categoría para el documento.");

    const body = new FormData();
    body.set("file", file);
    body.set("category", effectiveCategory);

    setPending(true);
    try {
      const response = await fetch(replacing ? `/api/documents/${replacing.id}` : "/api/documents", {
        method: replacing ? "PUT" : "POST",
        body,
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo subir el documento.");
        setPending(false);
        return;
      }
      reset();
      onDone(replacing ? `Se ha subido una nueva versión de «${file.name}».` : `«${file.name}» se ha subido.`);
    } catch {
      setError("No se pudo conectar con el servidor.");
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      variant="side"
      title={replacing ? `Reemplazar «${replacing.name}»` : "Subir documento"}
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {replacing && (
          <p className="text-sm text-ink-muted">
            Las respuestas que se redacten a partir de ahora usarán solo la nueva versión.
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="document-file" className="block text-sm font-medium">
            Archivo
          </label>
          <input
            id="document-file"
            type="file"
            accept={ACCEPT}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            aria-describedby="document-file-help"
            className="block w-full rounded-control border border-line-strong bg-panel text-sm text-ink file:mr-3 file:h-11 file:cursor-pointer file:border-0 file:border-r file:border-line file:bg-calm file:px-4 file:text-sm file:font-medium file:text-ink"
          />
          <p id="document-file-help" className="text-sm text-ink-muted">
            PDF, DOCX, TXT o Markdown, hasta 10 MB.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="document-category" className="block text-sm font-medium">
            Categoría
          </label>
          <select
            id="document-category"
            value={effectiveCategory}
            onChange={(event) => setCategory(event.target.value)}
            className="block h-11 w-full rounded-control border border-line-strong bg-panel px-3 text-base text-ink"
          >
            <option value="" disabled>
              Elige una categoría
            </option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Leyendo el documento…" : replacing ? "Subir nueva versión" : "Subir documento"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
