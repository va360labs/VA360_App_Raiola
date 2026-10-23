import { DocumentsManager } from "@/components/documents/DocumentsManager";
import type { DocumentRow } from "@/components/documents/types";
import { isCategory, listDocuments } from "@/lib/documents";
import { formatBytes, formatDateTime } from "@/lib/format";

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const activeCategory = isCategory(categoria) ? categoria : null;

  const all = listDocuments();
  const visible = activeCategory ? all.filter((d) => d.category === activeCategory) : all;
  const rows: DocumentRow[] = visible.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    status: d.status,
    size: d.size,
    version: d.version,
    updatedLabel: formatDateTime(d.updatedAt),
    sizeLabel: formatBytes(d.size),
  }));

  return <DocumentsManager documents={rows} activeCategory={activeCategory} totalCount={all.length} />;
}
