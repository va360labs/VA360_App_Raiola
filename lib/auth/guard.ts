import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export function sessionTokenFrom(request: Request): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

/**
 * API routes check the session themselves (the middleware only guards pages):
 * a Node-runtime middleware that sees request bodies can break multipart uploads.
 * Returns a 401 response to send back, or null when the session is valid.
 */
export async function requireSession(request: Request): Promise<NextResponse | null> {
  if (await verifySessionToken(sessionTokenFrom(request))) return null;
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}
