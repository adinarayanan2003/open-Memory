import { describe, expect, it } from "vitest";
import { MemoryEngine } from "../src/engine/memory-engine.js";
import { InProcessJobQueue } from "../src/queue/job-queue.js";
import { InMemoryStore } from "../src/repositories/in-memory-store.js";

describe("job queue facade", () => {
  it("runs extraction jobs through the shared dispatcher", async () => {
    const engine = new MemoryEngine(new InMemoryStore());
    const queue = new InProcessJobQueue(engine);
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Current work",
      text: "I am working on open-Memory and building a backend memory engine."
    });

    const job = await queue.enqueue("extract_source", { sourceRecordId: source.id, userId: "user" });
    await queue.run(job.id);
    const stored = await queue.get(job.id);

    expect(stored?.status).toBe("succeeded");
    expect(stored?.attemptsMade).toBeGreaterThan(0);
    expect((await engine.store.listAssertions()).length).toBeGreaterThan(0);
  });

  it("records failed jobs with error summaries", async () => {
    const engine = new MemoryEngine(new InMemoryStore());
    const queue = new InProcessJobQueue(engine);

    const job = await queue.enqueue("extract_source", { sourceRecordId: "missing", userId: "user" });
    await queue.run(job.id);
    const stored = await queue.get(job.id);

    expect(stored?.status).toBe("failed");
    expect(stored?.error).toContain("Source not found");
  });

  it("lists recent jobs by status", async () => {
    const engine = new MemoryEngine(new InMemoryStore());
    const queue = new InProcessJobQueue(engine);
    const job = await queue.enqueue("extract_source", { sourceRecordId: "missing", userId: "user" });
    await queue.run(job.id);

    const failed = await queue.list({ status: "failed" });

    expect(failed.map((item) => item.id)).toContain(job.id);
  });
});

