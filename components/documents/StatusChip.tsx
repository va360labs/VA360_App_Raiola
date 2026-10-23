import { AlertTriangle, CheckCircle2, CircleX, Loader } from "lucide-react";
import type { DocumentStatus } from "@/lib/documents/categories";

const STATUS = {
  ready: { label: "Listo", Icon: CheckCircle2, className: "bg-action-subtle text-action-active" },
  no_text: { label: "Sin texto", Icon: AlertTriangle, className: "bg-review-subtle text-review" },
  processing: { label: "Leyendo", Icon: Loader, className: "bg-calm text-ink-muted" },
  error: { label: "No se pudo leer", Icon: CircleX, className: "bg-danger-subtle text-danger" },
} as const;

export function DocumentStatusChip({ status }: { status: DocumentStatus }) {
  const { label, Icon, className } = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${className}`}>
      <Icon aria-hidden size={14} strokeWidth={1.75} />
      {label}
    </span>
  );
}
