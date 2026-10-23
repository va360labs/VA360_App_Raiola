import { describe, expect, it, vi } from "vitest";
import { isApiPath, isPublicPath, safeNextPath } from "@/lib/auth/access";
import {
  clearLoginFailures,
  clientIp,
  LOCK_MS,
  loginLockRemaining,
  recordLoginFailure,
} from "@/lib/auth/rateLimit";
import {
  checkPassword,
  createSessionToken,
  SESSION_MAX_AGE_S,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/session";
import { useTempDataDir } from "../helpers";

describe("session", () => {
  useTempDataDir();

  it("accepts its own token and rejects missing or altered ones", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken(`${token.slice(0, -2)}xx`)).toBe(false);
  });

  it("is valid for 7 days and expires afterwards", async () => {
    const now = Date.UTC(2026, 9, 23, 10);
    const token = await createSessionToken(now);
    expect(await verifySessionToken(token, now + (SESSION_MAX_AGE_S - 60) * 1000)).toBe(true);
    expect(await verifySessionToken(token, now + (SESSION_MAX_AGE_S + 60) * 1000)).toBe(false);
  });

  it("rejects tokens signed with another key", async () => {
    vi.stubEnv("SESSION_SECRET", "otra-clave-de-firma-distinta");
    const foreign = await createSessionToken();
    vi.stubEnv("SESSION_SECRET", "");
    const { resetConfigCache } = await import("@/lib/config");
    resetConfigCache();
    expect(await verifySessionToken(foreign)).toBe(false);
  });

  it("checks the admin key", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(checkPassword("cualquiera")).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "clave-correcta");
    expect(checkPassword("clave-correcta")).toBe(true);
    expect(checkPassword("clave-incorrecta")).toBe(false);
    expect(checkPassword("")).toBe(false);
  });

  it("marks the cookie secure only in production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false, maxAge: SESSION_MAX_AGE_S });
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions().secure).toBe(true);
  });
});

describe("login rate limit", () => {
  useTempDataDir();
  const ip = "203.0.113.7";
  const t0 = 1_800_000_000_000;

  it("allows four failures and locks for 60 s on the fifth within a minute", () => {
    for (let i = 0; i < 4; i++) recordLoginFailure(ip, t0 + i * 1000);
    expect(loginLockRemaining(ip, t0 + 4000)).toBe(0);

    recordLoginFailure(ip, t0 + 5000);
    expect(loginLockRemaining(ip, t0 + 5000)).toBe(LOCK_MS);
    expect(loginLockRemaining(ip, t0 + 35_000)).toBe(30_000);
    expect(loginLockRemaining(ip, t0 + 5000 + LOCK_MS)).toBe(0);
  });

  it("does not lock when the failures are spread over more than a minute", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure(ip, t0 + i * 20_000);
    expect(loginLockRemaining(ip, t0 + 80_000)).toBe(0);
  });

  it("keeps each IP separate and clears after a successful login", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure(ip, t0 + i);
    expect(loginLockRemaining("198.51.100.1", t0 + 10)).toBe(0);
    clearLoginFailures(ip);
    expect(loginLockRemaining(ip, t0 + 10)).toBe(0);
  });

  it("reads the client IP behind the proxy", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("local");
  });
});

describe("access rules", () => {
  it("leaves login, auth, webhooks and health public", () => {
    for (const p of ["/login", "/api/auth/login", "/api/webhooks/whatsapp", "/api/webhooks/email", "/api/health"]) {
      expect(isPublicPath(p)).toBe(true);
    }
    for (const p of ["/", "/bandeja", "/documentos", "/api/messages", "/api/healthz", "/login/otra"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });

  it("detects API paths", () => {
    expect(isApiPath("/api/messages")).toBe(true);
    expect(isApiPath("/bandeja")).toBe(false);
  });

  it("only redirects to local panel paths after login", () => {
    expect(safeNextPath("/documentos")).toBe("/documentos");
    expect(safeNextPath(undefined)).toBe("/bandeja");
    expect(safeNextPath("https://otro.example")).toBe("/bandeja");
    expect(safeNextPath("//otro.example")).toBe("/bandeja");
    expect(safeNextPath("/login")).toBe("/bandeja");
  });
});
