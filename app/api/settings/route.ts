import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guard";
import { getSetting, setSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function current() {
  return {
    autoSend: getSetting("auto_send") === "true",
    ackMessage: getSetting("ack_message"),
    clinicName: getSetting("clinic_name"),
  };
}

const updateSchema = z.object({
  autoSend: z.boolean().optional(),
  ackMessage: z.string().trim().min(1, "Escribe el aviso de recepción.").max(500).optional(),
  clinicName: z.string().trim().max(80).optional(),
});

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  return NextResponse.json({ settings: current() });
}

export async function PUT(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos." }, { status: 400 });
  }
  const { autoSend, ackMessage, clinicName } = parsed.data;
  if (autoSend !== undefined) setSetting("auto_send", autoSend ? "true" : "false");
  if (ackMessage !== undefined) setSetting("ack_message", ackMessage);
  if (clinicName !== undefined) setSetting("clinic_name", clinicName);
  return NextResponse.json({ settings: current() });
}
