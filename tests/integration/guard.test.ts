import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import * as documents from "@/app/api/documents/route";
import * as documentById from "@/app/api/documents/[id]/route";
import * as messages from "@/app/api/messages/route";
import * as messageById from "@/app/api/messages/[id]/route";
import * as discard from "@/app/api/messages/[id]/discard/route";
import * as reopen from "@/app/api/messages/[id]/reopen/route";
import * as retry from "@/app/api/messages/[id]/retry/route";
import * as send from "@/app/api/messages/[id]/send/route";
import * as settings from "@/app/api/settings/route";
import * as conversations from "@/app/api/simulator/conversations/route";
import * as simulatorSend from "@/app/api/simulator/send/route";
import { requireSession, sessionTokenFrom } from "@/lib/auth/guard";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { useTempDataDir } from "../helpers";

const ctx = { params: Promise.resolve({ id: "1" }) };
const req = (method = "GET", cookie?: string) =>
  new NextRequest("http://localhost/api/x", { method, headers: cookie ? { cookie } : {}, body: method === "GET" ? undefined : "{}" });

describe("API session checks (AC-34)", () => {
  useTempDataDir();

  it("reads the session cookie among others", () => {
    const request = new Request("http://x", { headers: { cookie: `a=1; ${SESSION_COOKIE}=abc%3D; b=2` } });
    expect(sessionTokenFrom(request)).toBe("abc=");
    expect(sessionTokenFrom(new Request("http://x"))).toBeUndefined();
  });

  it("lets a valid session through", async () => {
    const cookie = `${SESSION_COOKIE}=${await createSessionToken()}`;
    expect(await requireSession(new Request("http://x", { headers: { cookie } }))).toBeNull();
  });

  it("answers 401 on every application operation without a session", async () => {
    const calls: [string, () => Promise<Response>][] = [
      ["GET /api/documents", () => documents.GET(req())],
      ["POST /api/documents", () => documents.POST(req("POST"))],
      ["GET /api/documents/1", () => documentById.GET(req(), ctx)],
      ["PUT /api/documents/1", () => documentById.PUT(req("PUT"), ctx)],
      ["DELETE /api/documents/1", () => documentById.DELETE(req("DELETE"), ctx)],
      ["GET /api/messages", () => messages.GET(req())],
      ["GET /api/messages/1", () => messageById.GET(req(), ctx)],
      ["POST send", () => send.POST(req("POST"), ctx)],
      ["POST discard", () => discard.POST(req("POST"), ctx)],
      ["POST reopen", () => reopen.POST(req("POST"), ctx)],
      ["POST retry", () => retry.POST(req("POST"), ctx)],
      ["GET /api/settings", () => settings.GET(req())],
      ["PUT /api/settings", () => settings.PUT(req("PUT"))],
      ["GET conversations", () => conversations.GET(req())],
      ["POST simulator", () => simulatorSend.POST(req("POST"))],
    ];
    for (const [name, call] of calls) {
      const response = await call();
      expect(response.status, name).toBe(401);
      expect(await response.json(), name).toEqual({ error: "No autorizado" });
    }

    const forged = await messages.GET(req("GET", `${SESSION_COOKIE}=no-es-un-token`));
    expect(forged.status).toBe(401);
  });
});
