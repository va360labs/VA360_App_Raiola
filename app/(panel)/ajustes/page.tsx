import { Settings } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AjustesPage() {
  return (
    <>
      <PageHeader title="Ajustes" />
      <EmptyState Icon={Settings} title="Ajustes de la clínica">
        Aquí activarás el envío automático y editarás el aviso de recepción. Estará disponible junto con la revisión
        de respuestas.
      </EmptyState>
    </>
  );
}
