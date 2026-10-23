import Link from "next/link";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function BandejaPage() {
  return (
    <>
      <PageHeader title="Bandeja" />
      <EmptyState Icon={Inbox} title="Todavía no hay mensajes">
        Aquí aparecerán los mensajes de WhatsApp y email con su respuesta preparada. Para probarlo, envía uno desde
        el{" "}
        <Link href="/simulador" className="text-action underline-offset-2 hover:underline">
          simulador
        </Link>
        .
      </EmptyState>
    </>
  );
}
