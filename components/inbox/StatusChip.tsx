import { AlertTriangle, Ban, CheckCircle2, Circle, Send } from "lucide-react";
import type { InboxStatus } from "@/lib/messages";
import { inboxStatusLabel } from "@/lib/messages/status";

const STYLE: Record<InboxStatus, { Icon: typeof Circle; className: string }> = {
  new: { Icon: Circle, className: "border border-line-strong text-ink" },
  draft_ready: { Icon: CheckCircle2, className: "bg-action-subtle text-action-active" },
  needs_review: { Icon: AlertTriangle, className: "bg-review-subtle text-review" },
  sent: { Icon: Send, className: "bg-calm text-ink-muted" },
  discarded: { Icon: Ban, className: "bg-calm text-ink-muted" },
};

export function StatusChip({ status, sendMode }: { status: InboxStatus; sendMode: string | null }) {
  const { Icon, className } = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${className}`}>
      <Icon aria-hidden size={14} strokeWidth={1.75} />
      {inboxStatusLabel(status, sendMode)}
    </span>
  );
}
