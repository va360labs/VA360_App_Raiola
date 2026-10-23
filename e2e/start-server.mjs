// Starts the production build on a fresh, empty data folder (the first start creates the database).
import { spawn } from "node:child_process";
import fs from "node:fs";

fs.rmSync(process.env.DATA_DIR ?? "e2e/.data", { recursive: true, force: true });
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", process.env.PORT ?? "3200"], {
  stdio: "inherit",
  env: process.env,
});
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
