import { NextResponse, type NextRequest } from "next/server";
import { buildSimulatedRequest, internalBaseUrl, simulatorInputSchema } from "@/lib/inbox/simulator";

export const runtime = "nodejs";

/** Sends a test message through the real webhook, exactly as WhatsApp or the email provider would. */
export async function POST(request: NextRequest) {
  const parsed = simulatorInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos." }, { status: 400 });
  }

  const call = buildSimulatedRequest(parsed.data);
  const response = await fetch(`${internalBaseUrl(request.nextUrl.origin)}${call.path}`, {
    method: "POST",
    headers: call.headers,
    body: call.body,
  }).catch(() => null);

  if (!response?.ok) {
    return NextResponse.json({ error: "El webhook no aceptó el mensaje simulado." }, { status: 502 });
  }
  return NextResponse.json(await response.json(), { status: 201 });
}
