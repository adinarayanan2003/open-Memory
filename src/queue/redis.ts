import { Redis } from "ioredis";

export const memoryQueueName = "open-memory-jobs";

export function redisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

export function queuePrefix(): string {
  return process.env.QUEUE_PREFIX ?? "open-memory";
}

export function createRedisConnection() {
  return new Redis(redisUrl(), {
    maxRetriesPerRequest: null
  });
}
