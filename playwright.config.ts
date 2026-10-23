import { defineConfig, devices } from "@playwright/test";
import { E2E_ENV, E2E_PORT } from "./e2e/env";

/**
 * Acceptance tests (one test per AC of the PRD) against the production build,
 * with a fresh data folder and the deterministic drafting model.
 * Run with: npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  // One shared server and database: run in order so settings changes do not cross tests.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: ".quality/evidence/respuestas-automaticas/acceptance/results.json" }],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /setup\.ts/ },
    {
      name: "acceptance",
      dependencies: ["setup"],
      testIgnore: /setup\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
    },
  ],
  webServer: {
    command: "node e2e/start-server.mjs",
    url: `http://localhost:${E2E_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: E2E_ENV,
  },
});
