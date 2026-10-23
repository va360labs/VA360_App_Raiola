import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DocumentosPage() {
  return (
    <>
      <PageHeader title="Documentos" />
      <EmptyState Icon={FileText} title="Aún no hay documentos">
        Aquí subirás las tarifas, los horarios, las políticas y las preguntas frecuentes de la clínica. La subida
        estará disponible en la siguiente fase.
      </EmptyState>
    </>
  );
}
