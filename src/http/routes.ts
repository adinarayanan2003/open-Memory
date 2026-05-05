import type { FastifyInstance } from "fastify";
import type { MemoryEngine } from "../engine/memory-engine.js";
import type { JobListStatus, MemoryJobQueue } from "../queue/job-queue.js";
import {
  answerQuestionSchema,
  createJobSchema,
  createTextSourceSchema,
  forgetMemorySchema,
  memoryQuerySchema
} from "./schemas.js";

export async function registerRoutes(app: FastifyInstance, engine: MemoryEngine, queue: MemoryJobQueue) {
  app.get("/health", async () => ({ ok: true }));

  app.post("/sources/manual", async (request) => {
    const body = createTextSourceSchema.parse(request.body);
    const source = await engine.createSource({ ...body, type: "manual" });
    const job = await queue.enqueue("extract_source", { sourceRecordId: source.id, userId: body.userId });
    return { source, job };
  });

  app.post("/sources/notes/import", async (request) => {
    const body = createTextSourceSchema.parse(request.body);
    const source = await engine.createSource({ ...body, type: "notes" });
    const job = await queue.enqueue("extract_source", { sourceRecordId: source.id, userId: body.userId });
    return { source, job };
  });

  app.post("/sources/files", async (request) => {
    const body = createTextSourceSchema.parse(request.body);
    const source = await engine.createSource({ ...body, type: "file_upload" });
    const job = await queue.enqueue("extract_source", { sourceRecordId: source.id, userId: body.userId });
    return { source, job };
  });

  app.get("/sources", async () => engine.store.listSourceRecords());
  app.get("/sources/:id", async (request) => {
    const { id } = request.params as { id: string };
    const source = await engine.store.getSourceRecord(id);
    if (!source) return app.httpErrors.notFound("Source not found");
    return source;
  });

  app.post("/ingestion/jobs", async (request) => {
    const body = createJobSchema.parse(request.body);
    return queue.enqueue(body.type, body.payload);
  });

  app.get("/jobs/:id", async (request) => {
    const { id } = request.params as { id: string };
    const job = await queue.get(id);
    if (!job) return app.httpErrors.notFound("Job not found");
    return job;
  });

  app.get("/jobs", async (request) => {
    const query = request.query as { status?: JobListStatus; limit?: string };
    return queue.list({
      status: query.status,
      limit: query.limit ? Number(query.limit) : undefined
    });
  });

  app.get("/nodes", async () => engine.store.listNodes());
  app.get("/nodes/:id", async (request) => {
    const { id } = request.params as { id: string };
    const node = await engine.store.getNode(id);
    if (!node) return app.httpErrors.notFound("Node not found");
    return node;
  });

  app.get("/assertions", async () => engine.store.listAssertions());
  app.get("/assertions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const assertion = await engine.store.getAssertion(id);
    if (!assertion) return app.httpErrors.notFound("Assertion not found");
    return assertion;
  });

  app.get("/patches", async (request) => {
    const query = request.query as { status?: "pending" | "accepted" | "rejected" | "needs_review" };
    return engine.store.listPatches(query.status);
  });

  app.post("/patches/:id/accept", async (request) => {
    const { id } = request.params as { id: string };
    return engine.graphAgent.acceptPatch(id);
  });

  app.post("/patches/:id/reject", async (request) => {
    const { id } = request.params as { id: string };
    const run = (await engine.store.listAgentRuns()).at(-1);
    const patch = await engine.graphAgent.rejectPatch(id);
    if (run) await engine.agentMemory.recordRejectedPatch(run, id);
    return patch;
  });

  app.get("/questions", async (request) => {
    const query = request.query as { status?: "open" | "answered" | "dismissed" | "expired" };
    return engine.store.listQuestions(query.status);
  });

  app.post("/questions/:id/answer", async (request) => {
    const { id } = request.params as { id: string };
    const body = answerQuestionSchema.parse(request.body);
    return engine.graphAgent.answerQuestion(id, body.answer);
  });

  app.post("/memory/query", async (request) => {
    const body = memoryQuerySchema.parse(request.body);
    return engine.retrievalAgent.query(body);
  });

  app.post("/memory/forget", async (request) => {
    const body = forgetMemorySchema.parse(request.body);
    await engine.graphAgent.makeForgetPatch(body.targetId);
    return { ok: true };
  });

  app.get("/agents/runs", async () => engine.store.listAgentRuns());
  app.get("/agents/memory", async () => engine.store.listAgentMemories());
}
