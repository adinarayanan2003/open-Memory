import { MemoryEngine } from "../src/engine/memory-engine.js";
import { BullMqJobQueue } from "../src/queue/bullmq-queue.js";
import { createMemoryWorker } from "../src/queue/bullmq-worker.js";
import { registerMaintenanceSchedules } from "../src/queue/scheduler.js";
import { InMemoryStore } from "../src/repositories/in-memory-store.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Socket } from "node:net";
import { redisUrl } from "../src/queue/redis.js";

describe("BullMQ durable queue", () => {
  const engine = new MemoryEngine(new InMemoryStore());
  let queue: BullMqJobQueue | undefined;
  let worker: ReturnType<typeof createMemoryWorker> | undefined;
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await canReachRedis();
    if (!redisAvailable) {
      throw new Error(`Redis is not reachable at ${redisUrl()}. Start it with: docker compose up -d redis`);
    }
    queue = new BullMqJobQueue();
    worker = createMemoryWorker(engine);
    await queue.queue.drain(true);
  });

  afterAll(async () => {
    await worker?.close();
    await queue?.close();
  });

  it("processes extraction jobs through a worker", async () => {
    if (!redisAvailable || !queue) throw new Error("Redis queue is not initialized");
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Current work",
      text: "I am working on open-Memory and building a backend memory engine."
    });
    const job = await queue.enqueue("extract_source", { sourceRecordId: source.id, userId: "user" });

    const completed = await waitForJob(job.id, "succeeded");

    expect(completed.status).toBe("succeeded");
    expect((await engine.store.listAssertions()).length).toBeGreaterThan(0);
  });

  it("registers repeatable maintenance jobs", async () => {
    if (!redisAvailable || !queue) throw new Error("Redis queue is not initialized");
    await registerMaintenanceSchedules(queue.queue);
    const delayed = await queue.list({ status: "delayed", limit: 20 });

    expect(delayed.some((job) => job.type === "freshness_sweep")).toBe(true);
    expect(delayed.some((job) => job.type === "contradiction_sweep")).toBe(true);
    expect(delayed.some((job) => job.type === "evidence_integrity")).toBe(true);
  });

  async function waitForJob(id: string, status: "succeeded" | "failed") {
    if (!queue) throw new Error("Queue is not initialized");
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const job = await queue.get(id);
      if (job?.status === status) return job;
      if (job?.status === "failed") throw new Error(job.error ?? "job failed");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for job ${id}`);
  }
});

async function canReachRedis(): Promise<boolean> {
  const parsed = new URL(redisUrl());
  const host = parsed.hostname;
  const port = Number(parsed.port || 6379);
  return new Promise((resolve) => {
    const socket = new Socket();
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}
