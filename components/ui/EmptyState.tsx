import type { LucideIcon } from "lucide-react";

export function EmptyState({
  Icon,
  title,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <Icon aria-hidden size={48} strokeWidth={1.5} className="text-ink-muted" />
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      {children && <div className="mt-2 max-w-md text-sm text-ink-muted">{children}</div>}
    </div>
  );
}
