import { policyVersion } from "../domain/policies.js";
import type { MemoryScope, SourceConnectionType, SourceRecord } from "../domain/types.js";
import { ExtractionAgent } from "../agents/extraction-agent.js";
import { GraphAgent } from "../agents/graph-agent.js";
import { IngestionAgent } from "../agents/ingestion-agent.js";
import { MaintenanceAgent } from "../agents/maintenance-agent.js";
import { RetrievalAgent } from "../agents/retrieval-agent.js";
import { AgentMemoryService } from "../agents/agent-memory-service.js";
import { newId, nowIso } from "../lib/id.js";
import type { MemoryStore } from "../repositories/memory-store.js";

export class MemoryEngine {
  readonly ingestionAgent: IngestionAgent;
  readonly extractionAgent = new ExtractionAgent();
  readonly graphAgent: GraphAgent;
  readonly maintenanceAgent: MaintenanceAgent;
  readonly retrievalAgent: RetrievalAgent;
  readonly agentMemory: AgentMemoryService;

  constructor(readonly store: MemoryStore) {
    this.ingestionAgent = new IngestionAgent(store);
    this.graphAgent = new GraphAgent(store);
    this.maintenanceAgent = new MaintenanceAgent(store);
    this.retrievalAgent = new RetrievalAgent(store);
    this.agentMemory = new AgentMemoryService(store);
  }

  async createSource(input: {
    userId: string;
    type: SourceConnectionType;
    title: string;
    text: string;
    suggestedScope?: MemoryScope;
  }): Promise<SourceRecord> {
    const now = nowIso();
    const connection = await this.store.createSourceConnection({
      id: newId("conn"),
      type: input.type,
      displayName: input.title,
      ownerUserId: input.userId,
      syncMode: "one_time",
      memoryScopePolicyId: "default-personal-scope",
      retentionPolicyId: "retain-local-v1",
      status: "active",
      createdAt: now
    });
    return this.store.createSourceRecord({
      id: newId("source"),
      connectionId: connection.id,
      sourceType: input.type,
      externalId: newId("external"),
      title: input.title,
      participants: [],
      fetchedAt: now,
      contentType: input.type === "manual" ? "manual" : input.type === "notes" ? "note" : "file",
      text: input.text,
      memoryScopeTags: [input.suggestedScope ?? "available_to_assistant"],
      sensitivityTags: [],
      metadata: {}
    });
  }

  async runExtractionPipeline(sourceRecordId: string, userId = "user"): Promise<{
    patchIds: string[];
    questionIds: string[];
  }> {
    const source = await this.store.getSourceRecord(sourceRecordId);
    if (!source) throw new Error(`Source not found: ${sourceRecordId}`);
    const run = await this.agentMemory.startRun({
      agentId: "extraction-pipeline-v1",
      userId,
      taskType: "extract_source",
      inputRefs: [sourceRecordId],
      toolsUsed: ["heuristic-extractor"]
    });

    try {
      const { chunks, evidence } = await this.ingestionAgent.ingestSourceRecord(source);
      const extracted = await this.extractionAgent.extract(chunks);
      const evidenceByChunk = new Map(evidence.map((item) => [item.sourceId, item.id]));
      const patchIds: string[] = [];
      const questionIds: string[] = [];

      for (const candidate of extracted.candidates) {
        const evidenceIds = candidate.evidenceChunkIds
          .map((chunkId) => evidenceByChunk.get(chunkId))
          .filter((id): id is string => Boolean(id));
        const patch = await this.graphAgent.proposePatch(candidate, evidenceIds);
        const validated = await this.graphAgent.validatePatch(patch);
        patchIds.push(validated.id);
        if (validated.status === "needs_review") {
          const question = await this.graphAgent.createQuestionFromPatch(validated);
          questionIds.push(question.id);
        }
      }

      for (const proposed of extracted.proposedQuestions) {
        const question = await this.store.createQuestion({
          id: newId("question"),
          questionKind: proposed.kind,
          prompt: proposed.prompt,
          relatedNodeIds: [],
          evidenceIds: proposed.evidenceChunkIds
            .map((chunkId) => evidenceByChunk.get(chunkId))
            .filter((id): id is string => Boolean(id)),
          priority: proposed.priority,
          status: "open",
          createdBy: "question-agent-v1",
          createdAt: nowIso()
        });
        questionIds.push(question.id);
      }

      await this.agentMemory.finishRun(run, {
        status: "succeeded",
        outputPatchIds: patchIds,
        questionIds,
        policyVersion
      });
      return { patchIds, questionIds };
    } catch (error) {
      await this.agentMemory.finishRun(run, {
        status: "failed",
        errorSummary: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

