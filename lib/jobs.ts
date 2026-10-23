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

export function pendingJobs(type: JobType): { id: number; payload: DraftJobPayload }[] {
  return (
    getDb().prepare("SELECT id, payload FROM jobs WHERE type = ? AND status = 'pending' ORDER BY id").all(type) as {
      id: number;
      payload: string;
    }[]
  ).map((row) => ({ id: row.id, payload: JSON.parse(row.payload) as DraftJobPayload }));
}
