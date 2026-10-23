import { reopenMessage } from "@/lib/messages";
import { runAction } from "../actions";

export const runtime = "nodejs";

export function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return runAction(ctx, reopenMessage);
}
