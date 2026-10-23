import { getDb } from "@/lib/db";

export type JobType = "draft";

export interface DraftJobPayload {
  messageId: number;
}

/** Queues work for the in-process worker (it starts in phase 4). */
export function enqueueJob(type: JobType, payload: DraftJobPayload): number {
  const result = getDb()
    .prepare("INSERT INTO jobs (type, payload) VALUES (?, ?)")
    .run(type, JSON.stringify(payload));
  return Number(result.lastInsertRowid);
}

export interface ClaimedJob {
  id: number;
  type: JobType;
  payload: DraftJobPayload;
  attempts: number;
}

/** Takes the oldest pending job atomically so two loops never run the same one. */
export function claimNextJob(): ClaimedJob | null {
  const row = getDb()
    .prepare(
      `UPDATE jobs SET status = 'running', attempts = attempts + 1
        WHERE id = (SELECT id FROM jobs WHERE status = 'pending'
                     AND run_after <= strftime('%Y-%m-%dT%H:%M:%fZ','now') ORDER BY id LIMIT 1)
        RETURNING id, type, payload, attempts`,
    )
    .get() as { id: number; type: JobType; payload: string; attempts: number } | undefined;
  return row ? { ...row, payload: JSON.parse(row.payload) as DraftJobPayload } : null;
}

export function finishJob(id: number, error?: string): void {
  getDb()
    .prepare("UPDATE jobs SET status = ?, last_error = ? WHERE id = ?")
    .run(error ? "failed" : "done", error ?? null, id);
}

/** Jobs left running by a crash or restart go back to the queue. */
export function requeueStaleJobs(): number {
  return getDb().prepare("UPDATE jobs SET status = 'pending' WHERE status = 'running'").run().changes;
}

export function pendingJobs(type: JobType): { id: number; payload: DraftJobPayload }[] {
  return (
    getDb().prepare("SELECT id, payload FROM jobs WHERE type = ? AND status = 'pending' ORDER BY id").all(type) as {
      id: number;
      payload: string;
    }[]
  ).map((row) => ({ id: row.id, payload: JSON.parse(row.payload) as DraftJobPayload }));
}
