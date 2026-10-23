"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Category } from "@/lib/documents/categories";
import { DocumentStatusChip } from "./StatusChip";
import { CATEGORIES, CATEGORY_OPTIONS, type DocumentRow } from "./types";
import { UploadPanel } from "./UploadPanel";

export function DocumentsManager({
  documents,
  activeCategory,
  totalCount,
}: {
  documents: DocumentRow[];
  activeCategory: Category | null;
  totalCount: number;
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replacing, setReplacing] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState<DocumentRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function openUpload(document: DocumentRow | null) {
    setNotice(null);
    setReplacing(document);
    setUploadOpen(true);
  }

  function closeUpload() {
    setUploadOpen(false);
    setReplacing(null);
  }

  function onUploaded(message: string) {
    closeUpload();
    setNotice(message);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    const response = await fetch(`/api/documents/${deleting.id}`, { method: "DELETE" }).catch(() => null);
    setDeletePending(false);
    if (!response || (!response.ok && response.status !== 404)) {
      setDeleteError("No se pudo eliminar el documento. Vuelve a intentarlo.");
      return;
    }
    setNotice(`«${deleting.name}» se ha eliminado.`);
    setDeleting(null);
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Documentos">
        <Button onClick={() => openUpload(null)}>
          <Upload aria-hidden size={18} strokeWidth={1.5} />
          Subir documento
        </Button>
      </PageHeader>

      <div className="mx-auto max-w-[960px] space-y-4 px-4 py-5 lg:px-6">
        <p className="text-sm text-ink-muted">
          Las respuestas solo usan los documentos en estado «Listo». Si un dato cambia, sube la nueva versión del
          documento.
        </p>

        {notice && (
          <p role="status" className="rounded-control border border-line bg-panel px-4 py-3 text-sm text-ink">
            {notice}
          </p>
        )}

        <nav aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
          <FilterLink href="/documentos" active={activeCategory === null} label="Todas" />
          {CATEGORY_OPTIONS.map((option) => (
            <FilterLink
              key={option.value}
              href={`/documentos?categoria=${option.value}`}
              active={activeCategory === option.value}
              label={option.label}
            />
          ))}
        </nav>

        {documents.length === 0 ? (
          <div className="rounded-panel border border-line bg-panel">
            {totalCount === 0 ? (
              <EmptyState Icon={FileText} title="Aún no hay documentos">
                Sube las tarifas, los horarios, las políticas y las preguntas frecuentes de la clínica. Las respuestas
                se redactarán solo con lo que pongan estos documentos.
              </EmptyState>
            ) : (
              <EmptyState Icon={FileText} title={`No hay documentos de ${CATEGORIES[activeCategory!]}`}>
                Elige otra categoría o sube uno nuevo.
              </EmptyState>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-panel border border-line bg-panel">
            {documents.map((document) => (
              <li key={document.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink" title={document.name}>
                    {document.name}
                  </p>
                  <p className="tabular mt-0.5 text-sm text-ink-muted">
                    {CATEGORIES[document.category]}, subido el {document.updatedLabel}, {document.sizeLabel}
                    {document.version > 1 && `, versión ${document.version}`}
                  </p>
                  {document.status === "no_text" && (
                    <p className="mt-1.5 text-sm text-review">
                      No se ha encontrado texto en este archivo (puede ser un escaneo). Sube una versión con texto para
                      que se pueda usar en las respuestas.
                    </p>
                  )}
                  {document.status === "error" && (
                    <p className="mt-1.5 text-sm text-danger">
                      El archivo no se ha podido leer. Comprueba que no está dañado y súbelo de nuevo.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <DocumentStatusChip status={document.status} />
                  <Button variant="secondary" onClick={() => openUpload(document)}>
                    Reemplazar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(document);
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <UploadPanel open={uploadOpen} replacing={replacing} onClose={closeUpload} onDone={onUploaded} />

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Eliminar documento">
        {deleting && (
          <div className="space-y-5">
            <p className="text-sm text-ink">
              ¿Eliminar «{deleting.name}»? Las respuestas dejarán de usar este documento. No se puede deshacer.
            </p>
            {deleteError && (
              <p role="alert" className="text-sm text-danger">
                {deleteError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deletePending}>
                {deletePending ? "Eliminando…" : "Eliminar documento"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium ${
        active ? "border-action bg-action-subtle text-action-active" : "border-line bg-panel text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
