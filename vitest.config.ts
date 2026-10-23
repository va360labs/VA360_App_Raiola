import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each file gets its own DATA_DIR; run files in separate processes.
    pool: "forks",
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
