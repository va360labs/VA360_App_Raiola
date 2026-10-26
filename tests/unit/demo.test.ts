import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { DEMO_CLINIC_NAME, DEMO_DOCUMENTS, seedDemoData } from "@/lib/demo/seed";
import { createDocument, deleteDocument, getReadyDocuments, listDocuments } from "@/lib/documents";
import { getSetting, setSetting } from "@/lib/settings";
import { TARIFAS_40, utf8 } from "../fixtures";
import { useTempDataDir } from "../helpers";

describe("demo data", () => {
  useTempDataDir();

  it("loads the demo clinic's five documents and its name on the first start", async () => {
    expect(await seedDemoData()).toBe("seeded");
    const docs = listDocuments();
    expect(docs.map((d) => [d.name, d.category, d.status]).sort()).toEqual(
      DEMO_DOCUMENTS.map(({ file, category }) => [file, category, "ready"]).sort(),
    );
    expect(getReadyDocuments().find((d) => d.name === "tarifas-y-bonos-2026.pdf")?.text).toContain("Bono de 10 sesiones 380 €");
    expect(getSetting("clinic_name")).toBe(DEMO_CLINIC_NAME);
  });

  it("runs only once, even if the documents are deleted afterwards", async () => {
    await seedDemoData();
    for (const doc of listDocuments()) deleteDocument(doc.id);
    expect(await seedDemoData()).toBe("skipped");
    expect(listDocuments()).toEqual([]);
  });

  it("starts empty with DEMO_DATOS=false", async () => {
    vi.stubEnv("DEMO_DATOS", "false");
    expect(await seedDemoData()).toBe("skipped");
    expect(listDocuments()).toEqual([]);
    expect(getSetting("clinic_name")).toBe("");
  });

  it("leaves an existing installation's documents alone", async () => {
    await createDocument({ name: "Tarifas 2026.txt", bytes: utf8(TARIFAS_40), category: "tarifas" });
    expect(await seedDemoData()).toBe("skipped");
    expect(listDocuments().map((d) => d.name)).toEqual(["Tarifas 2026.txt"]);
    expect(getSetting("demo_loaded")).toBe("true");
  });

  it("keeps a clinic name that is already set", async () => {
    setSetting("clinic_name", "Fisio Centro");
    await seedDemoData();
    expect(getSetting("clinic_name")).toBe("Fisio Centro");
  });

  it("loads nothing and says which files are missing when the demo folder is incomplete", async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "va360-demo-"));
    vi.stubEnv("DEMO_DIR", empty);
    await expect(seedDemoData()).rejects.toThrow("tarifas-y-bonos-2026.pdf");
    expect((getDb().prepare("SELECT COUNT(*) AS count FROM documents").get() as { count: number }).count).toBe(0);
    expect(getSetting("demo_loaded")).toBe("");
    fs.rmSync(empty, { recursive: true, force: true });
  });
});
