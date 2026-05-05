import type { Queue } from "bullmq";
import type { JobType, MemoryJobPayload } from "./job-queue.js";

const maintenanceSchedules: Array<{
  id: string;
  type: JobType;
  everyMs: number;
}> = [
  { id: "maintenance:freshness_sweep", type: "freshness_sweep", everyMs: 6 * 60 * 60 * 1000 },
  { id: "maintenance:contradiction_sweep", type: "contradiction_sweep", everyMs: 12 * 60 * 60 * 1000 },
  { id: "maintenance:evidence_integrity", type: "evidence_integrity", everyMs: 24 * 60 * 60 * 1000 }
];

export async function registerMaintenanceSchedules(queue: Queue<MemoryJobPayload, unknown, JobType>) {
  for (const schedule of maintenanceSchedules) {
    await queue.upsertJobScheduler(
      schedule.id as JobType,
      { every: schedule.everyMs },
      {
        name: schedule.type,
        data: { scheduled: true },
        opts: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000
          },
          removeOnComplete: {
            count: 500
          },
          removeOnFail: false
        }
      }
    );
  }
}

export function schedulesEnabled(): boolean {
  return process.env.MAINTENANCE_SCHEDULES_ENABLED !== "false";
}

