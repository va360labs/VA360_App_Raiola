import { sendReply } from "@/lib/messages";
import { runAction } from "../actions";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const body = (await request.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text : "";
  return runAction(ctx, (id) => sendReply(id, text));
}
