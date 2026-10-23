import { NextResponse } from "next/server";
import { isDbHealthy } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Container health check used by Coolify. */
export function GET() {
  if (isDbHealthy()) {
    return NextResponse.json({ status: "ok" });
  }
  return NextResponse.json({ status: "error", detail: "database unavailable" }, { status: 503 });
}
