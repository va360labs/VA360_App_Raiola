import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { listSimulatedConversations } from "@/lib/inbox/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  return NextResponse.json({ conversations: listSimulatedConversations() });
}
