import type { MemoryEngine } from "../engine/memory-engine.js";
import { newId, nowIso } from "../lib/id.js";

export type JobType = "extract_source" | "freshness_sweep" | "contradiction_sweep" | "evidence_integrity";

export type MemoryJob = {
  id: string;
  type: JobType;
  status: "queued" | "running" | "succeeded" | "failed";
  payload: Record<string, unknown>;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export class InProcessJobQueue {
  private readonly jobs = new Map<string, MemoryJob>();

  constructor(private readonly engine: MemoryEngine) {}

  async enqueue(type: JobType, payload: Record<string, unknown>): Promise<MemoryJob> {
    const job: MemoryJob = {
      id: newId("job"),
      type,
      status: "queued",
      payload,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    this.jobs.set(job.id, job);
    queueMicrotask(() => {
      void this.run(job.id);
    });
    return job;
  }

  async get(id: string): Promise<MemoryJob | undefined> {
    return this.jobs.get(id);
  }

  async run(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    this.jobs.set(id, { ...job, status: "running", updatedAt: nowIso() });
    try {
      const result = await this.dispatch(job);
      this.jobs.set(id, { ...job, status: "succeeded", result, updatedAt: nowIso() });
    } catch (error) {
      this.jobs.set(id, {
        ...job,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        updatedAt: nowIso()
      });
    }
  }

  private async dispatch(job: MemoryJob): Promise<unknown> {
    if (job.type === "extract_source") {
      const sourceRecordId = String(job.payload.sourceRecordId);
      const userId = String(job.payload.userId ?? "user");
      return this.engine.runExtractionPipeline(sourceRecordId, userId);
    }
    if (job.type === "freshness_sweep") {
      return this.engine.maintenanceAgent.runFreshnessSweep();
    }
    if (job.type === "contradiction_sweep") {
      return this.engine.maintenanceAgent.runContradictionSweep();
    }
    if (job.type === "evidence_integrity") {
      return this.engine.maintenanceAgent.runEvidenceIntegrity();
    }
    throw new Error(`Unsupported job type: ${job.type}`);
  }
}

