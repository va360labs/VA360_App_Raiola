export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3 lg:px-6">
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      {children}
    </div>
  );
}
