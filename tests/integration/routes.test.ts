import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { middleware } from "@/middleware";
import { resetConfigCache } from "@/lib/config";
import { closeDb } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { useTempDataDir } from "../helpers";

const BASE = "http://localhost:3000";

function loginRequest(password: string, ip = "203.0.113.9") {
  return new NextRequest(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ password }),
  });
}

describe("health check", () => {
  const tempDir = useTempDataDir();

  it("answers 200 with status ok when the database is reachable", async () => {
    const response = health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers 503 when the database is not reachable", async () => {
    closeDb();
    const blocker = path.join(tempDir(), "blocked");
    fs.writeFileSync(blocker, "x");
    vi.stubEnv("DATA_DIR", blocker);
    resetConfigCache();
    const response = health();
    expect(response.status).toBe(503);
    expect((await response.json()).status).toBe("error");
  });
});

describe("login and logout", () => {
  useTempDataDir();

  it("refuses to log in when no admin key is configured", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect((await login(loginRequest("algo"))).status).toBe(503);
  });

  it("rejects a wrong key and accepts the right one with a 7-day session cookie", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "clave-correcta");
    const wrong = await login(loginRequest("clave-incorrecta"));
    expect(wrong.status).toBe(401);
    expect(wrong.cookies.get(SESSION_COOKIE)).toBeUndefined();

    const ok = await login(loginRequest("clave-correcta"));
    expect(ok.status).toBe(200);
    const cookie = ok.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it("treats a malformed body as an empty key", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "clave-correcta");
    const request = new NextRequest(`${BASE}/api/auth/login`, { method: "POST", body: "no es json" });
    expect((await login(request)).status).toBe(401);
  });

  it("makes the IP wait 60 s after 5 failed attempts in a minute", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "clave-correcta");
    for (let i = 0; i < 5; i++) {
      expect((await login(loginRequest("mal"))).status).toBe(401);
    }
    const locked = await login(loginRequest("clave-correcta"));
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("Retry-After"))).toBeGreaterThan(55);
    expect((await locked.json()).retryAfterSeconds).toBeLessThanOrEqual(60);

    // Another IP is not affected.
    expect((await login(loginRequest("clave-correcta", "198.51.100.4"))).status).toBe(200);
  });

  it("clears the session cookie on logout and goes back to the login page", async () => {
    const response = logout(new NextRequest(`${BASE}/api/auth/logout`, { method: "POST" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${BASE}/login`);
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=;`);
  });
});

describe("access middleware", () => {
  useTempDataDir();

  async function request(pathname: string, signedIn = false) {
    const headers = new Headers();
    if (signedIn) headers.set("cookie", `${SESSION_COOKIE}=${await createSessionToken()}`);
    return middleware(new NextRequest(`${BASE}${pathname}`, { headers }));
  }

  it("redirects panel pages to the login page and keeps the destination", async () => {
    const response = await request("/documentos");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${BASE}/login?next=%2Fdocumentos`);

    const root = await request("/");
    expect(root.headers.get("location")).toBe(`${BASE}/login`);
  });

  it("answers 401 to application operations without a session", async () => {
    const response = await request("/api/messages");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "No autorizado" });
  });

  it("lets webhooks, the health check and the login page through without a session", async () => {
    for (const p of ["/api/webhooks/whatsapp", "/api/webhooks/email", "/api/health", "/login", "/api/auth/login"]) {
      const response = await request(p);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("lets a signed-in user in and sends them from the login page to the inbox", async () => {
    expect((await request("/bandeja", true)).headers.get("x-middleware-next")).toBe("1");
    expect((await request("/api/messages", true)).headers.get("x-middleware-next")).toBe("1");
    const fromLogin = await request("/login", true);
    expect(fromLogin.headers.get("location")).toBe(`${BASE}/bandeja`);
  });
});
