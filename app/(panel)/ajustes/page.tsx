import { SettingsForm } from "@/components/settings/SettingsForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSetting } from "@/lib/settings";

export default function AjustesPage() {
  return (
    <>
      <PageHeader title="Ajustes" />
      <SettingsForm
        initial={{
          autoSend: getSetting("auto_send") === "true",
          ackMessage: getSetting("ack_message"),
          clinicName: getSetting("clinic_name"),
        }}
      />
    </>
  );
}
