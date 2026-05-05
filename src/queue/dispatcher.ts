import type { MemoryEngine } from "../engine/memory-engine.js";
import type { JobType, MemoryJobPayload } from "./job-queue.js";

export async function dispatchMemoryJob(
  engine: MemoryEngine,
  type: JobType,
  payload: MemoryJobPayload
): Promise<unknown> {
  if (type === "extract_source") {
    const sourceRecordId = String(payload.sourceRecordId);
    const userId = String(payload.userId ?? "user");
    return engine.runExtractionPipeline(sourceRecordId, userId);
  }
  if (type === "freshness_sweep") {
    await engine.maintenanceAgent.runFreshnessSweep();
    return { ok: true };
  }
  if (type === "contradiction_sweep") {
    await engine.maintenanceAgent.runContradictionSweep();
    return { ok: true };
  }
  if (type === "evidence_integrity") {
    await engine.maintenanceAgent.runEvidenceIntegrity();
    return { ok: true };
  }
  throw new Error(`Unsupported job type: ${type satisfies never}`);
}

