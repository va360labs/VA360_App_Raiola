import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { createDocument, type Category } from "@/lib/documents";
import { getSetting, setSetting } from "@/lib/settings";

/** The fictional clinic of the webinar demo. Its documents ship with the app in demo/documentos. */
export const DEMO_CLINIC_NAME = "Fisioterapia Ribera Viva";

export const DEMO_DOCUMENTS: { file: string; category: Category }[] = [
  { file: "tarifas-y-bonos-2026.pdf", category: "tarifas" },
  { file: "horarios-y-ubicacion.pdf", category: "horarios" },
  { file: "politica-citas-y-pagos.docx", category: "politicas" },
  { file: "preguntas-frecuentes.txt", category: "faq" },
  { file: "tratamientos.pdf", category: "otros" },
];

export function demoDir(): string {
  return path.resolve(process.env.DEMO_DIR || path.join(process.cwd(), "demo", "documentos"));
}

/**
 * On the first start with no documents, loads the demo clinic's documents and name so a fresh
 * deployment is ready to show. Runs once: documents deleted later do not come back on restart.
 * DEMO_DATOS=false starts empty.
 */
export async function seedDemoData(): Promise<"seeded" | "skipped"> {
  if (process.env.DEMO_DATOS === "false" || getSetting("demo_loaded") === "true") return "skipped";

  const { count } = getDb().prepare("SELECT COUNT(*) AS count FROM documents").get() as { count: number };
  if (count > 0) {
    setSetting("demo_loaded", "true");
    return "skipped";
  }

  const dir = demoDir();
  const missing = DEMO_DOCUMENTS.filter(({ file }) => !fs.existsSync(path.join(dir, file)));
  if (missing.length > 0) {
    throw new Error(`Faltan documentos de demostración en ${dir}: ${missing.map(({ file }) => file).join(", ")}`);
  }

  for (const { file, category } of DEMO_DOCUMENTS) {
    await createDocument({ name: file, bytes: new Uint8Array(fs.readFileSync(path.join(dir, file))), category });
  }
  if (!getSetting("clinic_name").trim()) setSetting("clinic_name", DEMO_CLINIC_NAME);
  setSetting("demo_loaded", "true");
  return "seeded";
}
