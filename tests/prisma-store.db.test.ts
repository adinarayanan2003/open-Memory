import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryEngine } from "../src/engine/memory-engine.js";
import { PrismaMemoryStore } from "../src/repositories/prisma-store.js";

process.env.DATABASE_URL ??= "postgresql://open_memory:open_memory@localhost:5432/open_memory?schema=public";

const prisma = new PrismaClient();

async function clearDb() {
  await prisma.agentMemoryRecord.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.question.deleteMany();
  await prisma.graphPatch.deleteMany();
  await prisma.assertion.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.node.deleteMany();
  await prisma.chunk.deleteMany();
  await prisma.sourceRecord.deleteMany();
  await prisma.sourceConnection.deleteMany();
  await prisma.user.deleteMany();
}

function buildEngine() {
  return new MemoryEngine(new PrismaMemoryStore(prisma));
}

describe("PrismaMemoryStore", () => {
  beforeEach(async () => {
    await clearDb();
  });

  afterAll(async () => {
    await clearDb();
    await prisma.$disconnect();
  });

  it("persists source records across store recreation", async () => {
    const engine = buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Persistent source",
      text: "I am working on open-Memory persistence."
    });

    const recreatedStore = new PrismaMemoryStore(prisma);
    const persisted = await recreatedStore.getSourceRecord(source.id);

    expect(persisted?.id).toBe(source.id);
    expect(persisted?.text).toContain("persistence");
  });

  it("persists extraction pipeline outputs", async () => {
    const engine = buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Persistent project",
      text: "I am working on open-Memory and building a backend memory engine."
    });

    await engine.runExtractionPipeline(source.id);

    expect(await prisma.chunk.count()).toBeGreaterThan(0);
    expect(await prisma.evidence.count()).toBeGreaterThan(0);
    expect(await prisma.graphPatch.count()).toBeGreaterThan(0);
    expect(await prisma.node.count()).toBeGreaterThan(0);
    expect(await prisma.assertion.count()).toBeGreaterThan(0);
    expect(await prisma.auditEvent.count()).toBeGreaterThan(0);
    expect(await prisma.agentRun.count()).toBe(1);
  });

  it("persists needs-review patches and questions", async () => {
    const engine = buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Sensitive memory",
      text: "I prefer to keep health and finance notes private."
    });

    await engine.runExtractionPipeline(source.id);

    const needsReview = await engine.store.listPatches("needs_review");
    const openQuestions = await engine.store.listQuestions("open");

    expect(needsReview.length).toBeGreaterThan(0);
    expect(openQuestions.length).toBeGreaterThan(0);
  });

  it("persists accepted memory and retrieves it after store recreation", async () => {
    const engine = buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "notes",
      title: "Writing preference",
      text: "I prefer concise answers when discussing implementation plans."
    });
    await engine.runExtractionPipeline(source.id);

    const recreatedEngine = new MemoryEngine(new PrismaMemoryStore(prisma));
    const result = await recreatedEngine.retrievalAgent.query({
      userId: "user",
      query: "concise answers",
      includeEvidence: true
    });

    expect(result.assertions.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.sourceSnippets[0]?.text).toContain("concise");
  });

  it("persists forgetting cascade and excludes forgotten memories from retrieval", async () => {
    const engine = buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Forget project",
      text: "I am working on open-Memory and building a backend memory engine."
    });
    await engine.runExtractionPipeline(source.id);
    const node = (await engine.store.listNodes()).find((item) => item.type === "Project");
    expect(node).toBeDefined();

    await engine.graphAgent.makeForgetPatch(node!.id);

    const dbNode = await prisma.node.findUnique({ where: { id: node!.id } });
    const assertions = await prisma.assertion.findMany({ where: { objectNodeId: node!.id } });
    const result = await engine.retrievalAgent.query({ userId: "user", query: "open-Memory" });

    expect(dbNode?.memoryState).toBe("forgotten");
    expect(assertions.every((assertion) => assertion.memoryState === "forgotten")).toBe(true);
    expect(result.nodes.some((item) => item.id === node!.id)).toBe(false);
  });

  it("persists rejected patch feedback as private agent memory", async () => {
    const engine = buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Ambiguous style",
      text: "Maybe I want a detailed style sometimes."
    });
    await engine.runExtractionPipeline(source.id);
    const patch = (await engine.store.listPatches())[0];
    const run = (await engine.store.listAgentRuns())[0];
    expect(patch).toBeDefined();
    expect(run).toBeDefined();

    await engine.graphAgent.rejectPatch(patch!.id);
    await engine.agentMemory.recordRejectedPatch(run!, patch!.id);

    const memories = await engine.store.listAgentMemories();
    expect(memories.length).toBe(1);
    expect(memories[0]?.summary).toContain("rejected");
  });
});
