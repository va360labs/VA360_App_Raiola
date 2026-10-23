import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { retryDraft } from "@/lib/drafting/service";

export const runtime = "nodejs";

/** «Reintentar»: queues the draft again for a message whose drafting failed. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const id = Number((await params).id);
  const result = Number.isInteger(id) && id > 0 ? retryDraft(id) : "not_found";
  if (result === "queued") return NextResponse.json({ status: "queued" }, { status: 202 });
  if (result === "not_found") return NextResponse.json({ error: "El mensaje no existe." }, { status: 404 });
  return NextResponse.json({ error: "Este mensaje no tiene un borrador fallido que reintentar." }, { status: 409 });
}
