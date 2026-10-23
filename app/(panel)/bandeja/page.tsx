import Link from "next/link";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function BandejaPage() {
  return (
    <>
      <PageHeader title="Bandeja" />
      <EmptyState Icon={Inbox} title="La bandeja llega en la fase 5">
        Aquí aparecerán los mensajes de WhatsApp y email con su respuesta preparada. Los mensajes ya se reciben: puedes
        enviar uno y ver su conversación en el{" "}
        <Link href="/simulador" className="text-action underline-offset-2 hover:underline">
          simulador
        </Link>
        .
      </EmptyState>
    </>
  );
}
