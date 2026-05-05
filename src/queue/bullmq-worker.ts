import { Worker } from "bullmq";
import type { MemoryEngine } from "../engine/memory-engine.js";
import { dispatchMemoryJob } from "./dispatcher.js";
import type { JobType, MemoryJobPayload } from "./job-queue.js";
import { createRedisConnection, memoryQueueName, queuePrefix } from "./redis.js";

export function createMemoryWorker(engine: MemoryEngine) {
  return new Worker<MemoryJobPayload, unknown, JobType>(
    memoryQueueName,
    async (job) => {
      const started = Date.now();
      console.log(`[worker] start ${job.name} ${job.id}`);
      try {
        const result = await dispatchMemoryJob(engine, job.name as JobType, job.data);
        console.log(`[worker] success ${job.name} ${job.id} ${Date.now() - started}ms`);
        return result;
      } catch (error) {
        console.error(`[worker] failed ${job.name} ${job.id}`, error);
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      prefix: queuePrefix(),
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2)
    }
  );
}

