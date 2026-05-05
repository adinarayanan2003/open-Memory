import { policyVersion } from "../domain/policies.js";
import type { AgentRun } from "../domain/types.js";
import { newId, nowIso } from "../lib/id.js";
import type { MemoryStore } from "../repositories/memory-store.js";

export class AgentMemoryService {
  constructor(private readonly store: MemoryStore) {}

  async startRun(input: {
    agentId: string;
    userId: string;
    taskType: string;
    inputRefs: string[];
    toolsUsed?: string[];
  }): Promise<AgentRun> {
    return this.store.createAgentRun({
      id: newId("run"),
      agentId: input.agentId,
      userId: input.userId,
      taskType: input.taskType,
      inputRefs: input.inputRefs,
      outputPatchIds: [],
      questionIds: [],
      toolsUsed: input.toolsUsed ?? [],
      policyVersion,
      status: "running",
      startedAt: nowIso()
    });
  }

  async finishRun(run: AgentRun, update: Partial<AgentRun>): Promise<AgentRun> {
    return this.store.updateAgentRun({
      ...run,
      ...update,
      status: update.status ?? "succeeded",
      finishedAt: nowIso()
    });
  }

  async recordRejectedPatch(run: AgentRun, patchId: string): Promise<void> {
    await this.store.createAgentMemory({
      id: newId("agentmem"),
      agentId: run.agentId,
      userId: run.userId,
      memoryKind: "user_feedback",
      summary: `Patch ${patchId} was rejected; be more conservative for similar candidates.`,
      sourceRunIds: [run.id],
      relatedPolicyIds: [policyVersion],
      scope: "agent_type_for_user",
      sensitivity: "low",
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }
}

