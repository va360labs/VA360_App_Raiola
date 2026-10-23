/** Runs once when the server starts: creates the database and applies migrations. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db");
    getDb();
  }
}
