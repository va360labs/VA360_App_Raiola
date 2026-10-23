/** Runs once when the server starts: creates the database, applies migrations and starts the drafting worker. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db");
    getDb();
    const { startWorker } = await import("./lib/drafting/worker");
    startWorker();
  }
}
