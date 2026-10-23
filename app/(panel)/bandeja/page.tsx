import { Suspense } from "react";
import { InboxView } from "@/components/inbox/InboxView";

export default function BandejaPage() {
  return (
    <Suspense>
      <InboxView />
    </Suspense>
  );
}
