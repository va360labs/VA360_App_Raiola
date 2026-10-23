import { NextResponse, type NextRequest } from "next/server";
import { getSecrets } from "@/lib/config";
import { hasValidEmailToken, parseInboundEmail } from "@/lib/inbox/email";
import { ingestMessages } from "@/lib/inbox/ingest";
import { PayloadError } from "@/lib/inbox/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Inbound email in Postmark's JSON format. */
export async function POST(request: NextRequest) {
  if (!hasValidEmailToken(request.headers, request.nextUrl.searchParams, getSecrets().emailWebhookToken)) {
    return NextResponse.json({ error: "Token no válido" }, { status: 401 });
  }

  const json = await request.json().catch(() => undefined);
  if (json === undefined) return NextResponse.json({ error: "El cuerpo no es JSON" }, { status: 400 });

  try {
    const { received, duplicates } = ingestMessages([parseInboundEmail(json)]);
    return NextResponse.json({ received, duplicates });
  } catch (error) {
    if (error instanceof PayloadError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
