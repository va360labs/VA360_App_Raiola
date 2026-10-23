import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SimuladorPage() {
  return (
    <>
      <PageHeader title="Simulador" />
      <EmptyState Icon={MessagesSquare} title="Simulador de mensajes">
        Desde aquí podrás enviar mensajes de prueba por WhatsApp o email, que entrarán por el mismo camino que los
        reales. Estará disponible cuando se conecte la entrada de mensajes.
      </EmptyState>
    </>
  );
}
