import { NextResponse, type NextRequest } from "next/server";
import { getSecrets, whatsappAppSecret } from "@/lib/config";
import { ingestMessages } from "@/lib/inbox/ingest";
import { PayloadError } from "@/lib/inbox/types";
import { parseWhatsAppPayload, verifySignatureIfConfigured, verifySubscription } from "@/lib/inbox/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subscription check from Meta when the webhook is configured. */
export function GET(request: NextRequest) {
  const challenge = verifySubscription(request.nextUrl.searchParams, getSecrets().whatsappVerifyToken);
  if (challenge === null) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/** Incoming messages. Answers fast; drafting happens in the background. */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySignatureIfConfigured(rawBody, request.headers.get("x-hub-signature-256"), whatsappAppSecret())) {
    return NextResponse.json({ error: "Firma no válida" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON" }, { status: 400 });
  }

  try {
    const { received, duplicates } = ingestMessages(parseWhatsAppPayload(json));
    return NextResponse.json({ received, duplicates });
  } catch (error) {
    if (error instanceof PayloadError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
