import { Job, Queue } from "bullmq";
import type { JobListStatus, JobType, ListJobsOptions, MemoryJob, MemoryJobPayload, MemoryJobQueue } from "./job-queue.js";
import { createRedisConnection, memoryQueueName, queuePrefix } from "./redis.js";

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000
  },
  removeOnComplete: {
    count: 500
  },
  removeOnFail: false
} as const;

export class BullMqJobQueue implements MemoryJobQueue {
  readonly queue: Queue<MemoryJobPayload, unknown, JobType>;

  constructor() {
    this.queue = new Queue<MemoryJobPayload, unknown, JobType>(memoryQueueName, {
      connection: createRedisConnection(),
      prefix: queuePrefix(),
      defaultJobOptions
    });
  }

  async enqueue(type: JobType, payload: MemoryJobPayload): Promise<MemoryJob> {
    const job = await this.queue.add(type, payload);
    return toMemoryJob(job);
  }

  async get(id: string): Promise<MemoryJob | undefined> {
    const job = await Job.fromId<MemoryJobPayload, unknown, JobType>(this.queue, id);
    return job ? toMemoryJob(job) : undefined;
  }

  async list(options: ListJobsOptions = {}): Promise<MemoryJob[]> {
    const status = options.status ?? ["waiting", "active", "completed", "failed", "delayed"];
    const limit = options.limit ?? 50;
    const jobs = await this.queue.getJobs(status as JobListStatus | JobListStatus[], 0, Math.max(limit - 1, 0), false);
    return Promise.all(jobs.map(toMemoryJob));
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.queue.disconnect();
  }
}

export async function toMemoryJob(job: Job<MemoryJobPayload, unknown, JobType>): Promise<MemoryJob> {
  const state = await job.getState();
  return {
    id: String(job.id),
    type: job.name as JobType,
    status: mapBullState(state),
    payload: job.data,
    result: job.returnvalue,
    error: job.failedReason,
    attemptsMade: job.attemptsMade,
    createdAt: new Date(job.timestamp).toISOString(),
    updatedAt: new Date(job.finishedOn ?? job.processedOn ?? job.timestamp).toISOString(),
    processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
    finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined
  };
}

function mapBullState(state: string): MemoryJob["status"] {
  if (state === "active") return "running";
  if (state === "completed") return "succeeded";
  if (state === "failed") return "failed";
  if (state === "delayed") return "delayed";
  return "queued";
}

