import { NextResponse, type NextRequest } from "next/server";
import { adminPassword } from "@/lib/config";
import { clearLoginFailures, clientIp, loginLockRemaining, recordLoginFailure } from "@/lib/auth/rateLimit";
import { checkPassword, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!adminPassword()) {
    return NextResponse.json(
      { error: "La clave de administración no está configurada en el servidor." },
      { status: 503 },
    );
  }

  const ip = clientIp(request.headers);
  const remainingMs = loginLockRemaining(ip);
  if (remainingMs > 0) {
    const retryAfterSeconds = Math.ceil(remainingMs / 1000);
    return NextResponse.json(
      { error: "Demasiados intentos fallidos.", retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";

  if (!checkPassword(password)) {
    recordLoginFailure(ip);
    return NextResponse.json({ error: "La clave no es correcta." }, { status: 401 });
  }

  clearLoginFailures(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  return response;
}
