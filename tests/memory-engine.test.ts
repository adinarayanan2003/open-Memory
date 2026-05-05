import { describe, expect, it } from "vitest";
import { MemoryEngine } from "../src/engine/memory-engine.js";
import { InMemoryStore } from "../src/repositories/in-memory-store.js";

async function buildEngine() {
  const engine = new MemoryEngine(new InMemoryStore());
  return engine;
}

describe("personal memory backend", () => {
  it("extracts and auto-accepts low-risk high-confidence memories with evidence", async () => {
    const engine = await buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Current work",
      text: "I am working on open-Memory and building a backend memory engine."
    });

    const result = await engine.runExtractionPipeline(source.id);

    expect(result.patchIds.length).toBeGreaterThan(0);
    const assertions = await engine.store.listAssertions();
    expect(assertions.length).toBeGreaterThan(0);
    expect(assertions[0]?.status).toBe("accepted");
    expect(assertions[0]?.evidenceIds.length).toBeGreaterThan(0);
    const audits = await engine.store.listAuditEvents();
    expect(audits.some((event) => event.eventType === "patch_applied")).toBe(true);
  });

  it("routes sensitive memories to questions instead of auto-accepting", async () => {
    const engine = await buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Sensitive preference",
      text: "I prefer to keep health and finance notes private."
    });

    const result = await engine.runExtractionPipeline(source.id);

    expect(result.questionIds.length).toBeGreaterThan(0);
    const patches = await engine.store.listPatches("needs_review");
    expect(patches.length).toBeGreaterThan(0);
    const assertions = await engine.store.listAssertions();
    expect(assertions.length).toBe(0);
  });

  it("returns evidence-backed retrieval packages", async () => {
    const engine = await buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "notes",
      title: "Writing style",
      text: "I prefer concise answers when discussing implementation plans."
    });
    await engine.runExtractionPipeline(source.id);

    const result = await engine.retrievalAgent.query({
      userId: "user",
      query: "concise answers",
      includeEvidence: true
    });

    expect(result.assertions.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.sourceSnippets[0]?.text).toContain("concise");
    expect(result.confidence).not.toBe("low");
  });

  it("excludes forgotten memories from retrieval", async () => {
    const engine = await buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Project",
      text: "I am working on open-Memory and building a backend memory engine."
    });
    await engine.runExtractionPipeline(source.id);
    const node = (await engine.store.listNodes()).find((item) => item.type === "Project");
    expect(node).toBeDefined();

    await engine.graphAgent.makeForgetPatch(node!.id);
    const result = await engine.retrievalAgent.query({ userId: "user", query: "open-Memory" });

    expect(result.nodes.some((item) => item.id === node!.id)).toBe(false);
  });

  it("records private agent memory when a patch is rejected", async () => {
    const engine = await buildEngine();
    const source = await engine.createSource({
      userId: "user",
      type: "manual",
      title: "Ambiguous",
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

