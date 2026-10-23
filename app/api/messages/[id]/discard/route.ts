import { discardMessage } from "@/lib/messages";
import { runAction } from "../actions";

export const runtime = "nodejs";

export function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return runAction(request, ctx, discardMessage);
}
