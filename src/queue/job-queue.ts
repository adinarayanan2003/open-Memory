import type { MemoryEngine } from "../engine/memory-engine.js";
import { newId, nowIso } from "../lib/id.js";
import { dispatchMemoryJob } from "./dispatcher.js";

export type JobType = "extract_source" | "freshness_sweep" | "contradiction_sweep" | "evidence_integrity";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "delayed";
export type JobListStatus = "waiting" | "active" | "completed" | "failed" | "delayed";
export type MemoryJobPayload = Record<string, unknown>;

export type MemoryJob = {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: MemoryJobPayload;
  result?: unknown;
  error?: string;
  attemptsMade: number;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  finishedAt?: string;
};

export type ListJobsOptions = {
  status?: JobListStatus;
  limit?: number;
};

export type MemoryJobQueue = {
  enqueue(type: JobType, payload: MemoryJobPayload): Promise<MemoryJob>;
  get(id: string): Promise<MemoryJob | undefined>;
  list(options?: ListJobsOptions): Promise<MemoryJob[]>;
  close?(): Promise<void>;
};

export class InProcessJobQueue implements MemoryJobQueue {
  private readonly jobs = new Map<string, MemoryJob>();

  constructor(private readonly engine: MemoryEngine) {}

  async enqueue(type: JobType, payload: MemoryJobPayload): Promise<MemoryJob> {
    const job: MemoryJob = {
      id: newId("job"),
      type,
      status: "queued",
      payload,
      attemptsMade: 0,
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

  async list(options: ListJobsOptions = {}): Promise<MemoryJob[]> {
    const status = options.status ? mapListStatus(options.status) : undefined;
    const limit = options.limit ?? 50;
    return [...this.jobs.values()]
      .filter((job) => (status ? job.status === status : true))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit);
  }

  async run(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    this.jobs.set(id, { ...job, status: "running", attemptsMade: job.attemptsMade + 1, updatedAt: nowIso(), processedAt: nowIso() });
    try {
      const result = await dispatchMemoryJob(this.engine, job.type, job.payload);
      this.jobs.set(id, {
        ...job,
        status: "succeeded",
        result,
        attemptsMade: job.attemptsMade + 1,
        updatedAt: nowIso(),
        processedAt: job.processedAt ?? nowIso(),
        finishedAt: nowIso()
      });
    } catch (error) {
      this.jobs.set(id, {
        ...job,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        attemptsMade: job.attemptsMade + 1,
        updatedAt: nowIso()
      });
    }
  }
}

function mapListStatus(status: JobListStatus): JobStatus {
  if (status === "waiting") return "queued";
  if (status === "active") return "running";
  if (status === "completed") return "succeeded";
  return status;
}
