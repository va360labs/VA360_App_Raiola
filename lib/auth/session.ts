import crypto from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { adminPassword, getSecrets } from "@/lib/config";

export const SESSION_COOKIE = "va360_session";
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

function signingKey(): Uint8Array {
  return new TextEncoder().encode(getSecrets().sessionSecret);
}

export async function createSessionToken(nowMs: number = Date.now()): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return new SignJWT({ sub: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_S)
    .sign(signingKey());
}

export async function verifySessionToken(token: string | undefined, nowMs: number = Date.now()): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
      currentDate: new Date(nowMs),
    });
    return true;
  } catch {
    return false;
  }
}

/** Constant-time comparison against the configured admin key. */
export function checkPassword(input: string): boolean {
  const expected = adminPassword();
  if (!expected) return false;
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Browsers accept Secure cookies on http://localhost, so this also works locally.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  };
}
