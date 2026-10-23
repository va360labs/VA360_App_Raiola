import { getDb } from "@/lib/db";
import { claimNextJob, finishJob, requeueStaleJobs } from "@/lib/jobs";
import { draftMessage } from "./service";

export const POLL_INTERVAL_MS = 1000;

/** Runs every pending job once, in order. Returns how many were processed. */
export async function drainQueue(): Promise<number> {
  let processed = 0;
  for (let job = claimNextJob(); job; job = claimNextJob()) {
    try {
      if (job.type === "draft") await draftMessage(job.payload.messageId);
      finishJob(job.id);
    } catch (error) {
      finishJob(job.id, error instanceof Error ? error.message : String(error));
    }
    processed++;
  }
  return processed;
}

const globalForWorker = globalThis as unknown as { __va360Worker?: NodeJS.Timeout };

/** Background loop inside the server process (single instance: one container in Coolify). */
export function startWorker(intervalMs: number = POLL_INTERVAL_MS): boolean {
  if (globalForWorker.__va360Worker || process.env.DISABLE_WORKER === "true") return false;
  getDb();
  requeueStaleJobs();
  // Messages left mid-draft by a restart are drafted again.
  getDb().prepare("UPDATE messages SET status = 'new' WHERE status = 'drafting'").run();

  let busy = false;
  globalForWorker.__va360Worker = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await drainQueue();
    } finally {
      busy = false;
    }
  }, intervalMs);
  globalForWorker.__va360Worker.unref?.();
  return true;
}

export function stopWorker(): void {
  if (globalForWorker.__va360Worker) clearInterval(globalForWorker.__va360Worker);
  globalForWorker.__va360Worker = undefined;
}
