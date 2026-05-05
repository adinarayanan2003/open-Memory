import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import { MemoryEngine } from "./engine/memory-engine.js";
import { createMemoryWorker } from "./queue/bullmq-worker.js";
import type { JobType, MemoryJobPayload } from "./queue/job-queue.js";
import { createRedisConnection, memoryQueueName, queuePrefix } from "./queue/redis.js";
import { registerMaintenanceSchedules, schedulesEnabled } from "./queue/scheduler.js";
import { PrismaMemoryStore } from "./repositories/prisma-store.js";

const prisma = new PrismaClient();
const engine = new MemoryEngine(new PrismaMemoryStore(prisma));
const worker = createMemoryWorker(engine);
const schedulerQueue = new Queue<MemoryJobPayload, unknown, JobType>(memoryQueueName, {
  connection: createRedisConnection(),
  prefix: queuePrefix()
});

worker.on("ready", () => {
  console.log("[worker] ready");
});

worker.on("failed", (job, error) => {
  console.error(`[worker] job failed ${job?.name ?? "unknown"} ${job?.id ?? "unknown"}`, error);
});

if (schedulesEnabled()) {
  await registerMaintenanceSchedules(schedulerQueue);
  console.log("[worker] maintenance schedules registered");
}

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down`);
  await worker.close();
  await schedulerQueue.close();
  await schedulerQueue.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

