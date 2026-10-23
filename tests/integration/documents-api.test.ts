import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as list, POST as upload } from "@/app/api/documents/route";
import { DELETE as remove, GET as getOne, PUT as replace } from "@/app/api/documents/[id]/route";
import { documentErrorResponse } from "@/app/api/documents/shared";
import { getReadyDocuments } from "@/lib/documents";
import { makePdf, TARIFAS_40, TARIFAS_45, utf8 } from "../fixtures";
import { useTempDataDir } from "../helpers";

// Route-level session checks are covered in tests/integration/guard.test.ts.
vi.mock("@/lib/auth/guard", () => ({ requireSession: async () => null }));

const BASE = "http://localhost:3000/api/documents";

function form(name: string | null, bytes: Uint8Array, category?: string) {
  const body = new FormData();
  if (name) body.set("file", new File([new Uint8Array(bytes)], name));
  if (category) body.set("category", category);
  return body;
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function uploadDoc(name: string, bytes: Uint8Array, category = "tarifas") {
  const response = await upload(new NextRequest(BASE, { method: "POST", body: form(name, bytes, category) }));
  return { response, body: await response.json() };
}

describe("documents API", () => {
  useTempDataDir();

  it("uploads a document and returns it ready", async () => {
    const started = Date.now();
    const { response, body } = await uploadDoc("Tarifas.pdf", makePdf(["Sesión de fisioterapia: 40 €"]));
    expect(response.status).toBe(201);
    expect(body.document).toMatchObject({ name: "Tarifas.pdf", category: "tarifas", status: "ready", version: 1 });
    expect(Date.now() - started).toBeLessThan(30_000);
  });

  it("explains why an upload is rejected", async () => {
    const wrong = await uploadDoc("foto.jpg", utf8("x"));
    expect(wrong.response.status).toBe(400);
    expect(wrong.body).toEqual({ error: "Formato no admitido. Sube un PDF, DOCX, TXT o Markdown.", code: "invalid_format" });

    const noCategory = await upload(new NextRequest(BASE, { method: "POST", body: form("a.txt", utf8("Texto con palabras")) }));
    expect(noCategory.status).toBe(400);
    expect((await noCategory.json()).code).toBe("invalid_category");

    const noFile = await upload(new NextRequest(BASE, { method: "POST", body: form(null, utf8("")) }));
    expect(noFile.status).toBe(400);
    expect((await noFile.json()).code).toBe("missing_file");

    const notMultipart = await upload(new NextRequest(BASE, { method: "POST", body: "texto" }));
    expect(notMultipart.status).toBe(400);
  });

  it("lists documents and filters by category, ignoring unknown categories", async () => {
    await uploadDoc("Tarifas.txt", utf8(TARIFAS_40), "tarifas");
    await uploadDoc("Horarios.txt", utf8("Lunes a viernes de 9:00 a 20:00"), "horarios");

    const all = await (await list(new NextRequest(BASE))).json();
    expect(all.documents.map((d: { name: string }) => d.name).sort()).toEqual(["Horarios.txt", "Tarifas.txt"]);

    const filtered = await (await list(new NextRequest(`${BASE}?category=horarios`))).json();
    expect(filtered.documents.map((d: { name: string }) => d.name)).toEqual(["Horarios.txt"]);

    const unknown = await (await list(new NextRequest(`${BASE}?category=inventada`))).json();
    expect(unknown.documents).toHaveLength(2);
  });

  it("returns one document or 404", async () => {
    const { body } = await uploadDoc("Tarifas.txt", utf8(TARIFAS_40));
    expect((await getOne(new NextRequest(BASE), params(String(body.document.id)))).status).toBe(200);
    expect((await getOne(new NextRequest(BASE), params("999"))).status).toBe(404);
    expect((await getOne(new NextRequest(BASE), params("abc"))).status).toBe(404);
  });

  it("replaces a document with a new version", async () => {
    const { body } = await uploadDoc("Tarifas.txt", utf8(TARIFAS_40));
    const id = String(body.document.id);

    const response = await replace(new NextRequest(`${BASE}/${id}`, { method: "PUT", body: form("Tarifas.txt", utf8(TARIFAS_45)) }), params(id));
    expect(response.status).toBe(200);
    expect((await response.json()).document).toMatchObject({ version: 2, category: "tarifas" });
    expect(getReadyDocuments()[0].text).toContain("45 €");

    const noFile = await replace(new NextRequest(`${BASE}/${id}`, { method: "PUT", body: form(null, utf8("")) }), params(id));
    expect(noFile.status).toBe(400);
    const missing = await replace(new NextRequest(`${BASE}/9`, { method: "PUT", body: form("a.txt", utf8("Texto con palabras")) }), params("9"));
    expect(missing.status).toBe(404);
    const badId = await replace(new NextRequest(`${BASE}/x`, { method: "PUT", body: form("a.txt", utf8("x")) }), params("x"));
    expect(badId.status).toBe(404);
  });

  it("deletes a document once", async () => {
    const { body } = await uploadDoc("Tarifas.txt", utf8(TARIFAS_40));
    const id = String(body.document.id);
    expect((await remove(new NextRequest(`${BASE}/${id}`, { method: "DELETE" }), params(id))).status).toBe(204);
    expect((await remove(new NextRequest(`${BASE}/${id}`, { method: "DELETE" }), params(id))).status).toBe(404);
    expect((await remove(new NextRequest(`${BASE}/0`, { method: "DELETE" }), params("0"))).status).toBe(404);
    expect(getReadyDocuments()).toEqual([]);
  });

  it("does not hide unexpected errors", () => {
    expect(() => documentErrorResponse(new Error("boom"))).toThrow("boom");
  });
});
