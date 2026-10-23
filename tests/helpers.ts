import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, vi } from "vitest";
import { resetConfigCache } from "@/lib/config";
import { closeDb } from "@/lib/db";

/** Gives every test a fresh, empty DATA_DIR and clean caches. Returns a getter for the path. */
export function useTempDataDir(): () => string {
  let dir = "";
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "va360-test-"));
    vi.stubEnv("DATA_DIR", dir);
    resetConfigCache();
  });
  afterEach(() => {
    closeDb();
    resetConfigCache();
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return () => dir;
}
