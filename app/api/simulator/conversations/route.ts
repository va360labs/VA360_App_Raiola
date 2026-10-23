import { NextResponse } from "next/server";
import { listSimulatedConversations } from "@/lib/inbox/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ conversations: listSimulatedConversations() });
}
