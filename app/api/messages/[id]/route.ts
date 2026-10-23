import { NextResponse } from "next/server";
import { getMessageDetail } from "@/lib/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const detail = Number.isInteger(id) && id > 0 ? getMessageDetail(id) : null;
  if (!detail) return NextResponse.json({ error: "El mensaje no existe." }, { status: 404 });
  return NextResponse.json({ message: detail });
}
