import { NextResponse } from "next/server";
import { MessageActionError } from "@/lib/messages";

type Params = { params: Promise<{ id: string }> };

/** Runs a message action and maps its errors to 404 / 409 / 400. */
export async function runAction(ctx: Params, action: (id: number) => unknown) {
  const id = Number((await ctx.params).id);
  try {
    if (!Number.isInteger(id) || id <= 0) throw new MessageActionError("not_found", "El mensaje no existe.");
    return NextResponse.json({ ok: true, result: action(id) ?? null });
  } catch (error) {
    if (!(error instanceof MessageActionError)) throw error;
    const status = error.code === "not_found" ? 404 : error.code === "invalid_state" ? 409 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
}
