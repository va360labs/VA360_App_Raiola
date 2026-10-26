/**
 * Runs once when the server starts: creates the database, applies migrations, loads the demo clinic's
 * documents on the first start and starts the drafting worker.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db");
    getDb();
    const { DEMO_CLINIC_NAME, DEMO_DOCUMENTS, seedDemoData } = await import("./lib/demo/seed");
    try {
      if ((await seedDemoData()) === "seeded") {
        console.log(`Datos de demostración cargados: ${DEMO_DOCUMENTS.length} documentos de ${DEMO_CLINIC_NAME}.`);
      }
    } catch (error) {
      console.error("No se pudieron cargar los datos de demostración:", error);
    }
    const { startWorker } = await import("./lib/drafting/worker");
    startWorker();
  }
}
