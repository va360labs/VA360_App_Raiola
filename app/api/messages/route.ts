import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { approvalStats, INBOX_STATUSES, listInbox, type InboxStatus } from "@/lib/messages";
import { countNeedsReview } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  const channel = params.get("channel");
  const status = params.get("status");
  return NextResponse.json({
    messages: listInbox({
      channel: channel === "whatsapp" || channel === "email" ? channel : undefined,
      status: INBOX_STATUSES.includes(status as InboxStatus) ? (status as InboxStatus) : undefined,
    }),
    needsReview: countNeedsReview(),
    stats: approvalStats(),
  });
}
