import { validatePatch } from "../domain/policies.js";
import type {
  Assertion,
  ExtractionCandidate,
  GraphPatch,
  MemoryScope,
  Node,
  NodeType,
  Predicate,
  Question
} from "../domain/types.js";
import { newId, nowIso } from "../lib/id.js";
import type { MemoryStore } from "../repositories/memory-store.js";

const nodeTypeByCandidate: Record<ExtractionCandidate["kind"], NodeType> = {
  project: "Project",
  preference: "Preference",
  decision: "Decision",
  open_loop: "OpenLoop",
  person: "Person",
  topic: "Topic",
  memory: "Memory"
};

const predicateByCandidate: Record<ExtractionCandidate["kind"], Predicate> = {
  project: "working_on",
  preference: "prefers",
  decision: "decided",
  open_loop: "committed_to",
  person: "related_to",
  topic: "related_to",
  memory: "mentions"
};

export class GraphAgent {
  constructor(private readonly store: MemoryStore) {}

  async proposePatch(candidate: ExtractionCandidate, evidenceIds: string[]): Promise<GraphPatch> {
    const nodeType = nodeTypeByCandidate[candidate.kind];
    const existing = await this.store.findNodeByLabel(nodeType, candidate.label);
    const now = nowIso();
    const node: Node =
      existing ??
      {
        id: newId("node"),
        type: nodeType,
        label: candidate.label,
        summary: candidate.summary,
        attributes: { candidateKind: candidate.kind },
        memoryState: candidate.sensitivity === "high" ? "sensitive" : "inferred",
        memoryScope: candidate.suggestedScope,
        currentVersion: "v1",
        createdAt: now,
        updatedAt: now
      };

    const assertion: Assertion = {
      id: newId("assertion"),
      subjectNodeId: "user",
      predicate: predicateByCandidate[candidate.kind],
      objectNodeId: node.id,
      qualifiers: { summary: candidate.summary },
      evidenceIds,
      confidence: candidate.confidence,
      status: "proposed",
      memoryState: candidate.sensitivity === "high" ? "sensitive" : "inferred",
      memoryScope: candidate.suggestedScope,
      createdBy: "assertion-agent-v1",
      currentVersion: "v1",
      createdAt: now,
      updatedAt: now
    };

    const patch: GraphPatch = {
      id: newId("patch"),
      proposedBy: "graph-agent-v1",
      reason: `Candidate ${candidate.kind}: ${candidate.label}`,
      operations: existing
        ? [{ op: "create_assertion", assertion }]
        : [
            { op: "create_node", node },
            { op: "create_assertion", assertion }
          ],
      evidenceIds,
      confidence: candidate.confidence,
      sensitivity: candidate.sensitivity,
      suggestedScope: candidate.suggestedScope,
      validationResults: [],
      status: "pending",
      createdAt: now
    };

    return this.store.createPatch(patch);
  }

  async validatePatch(patch: GraphPatch): Promise<GraphPatch> {
    const validation = validatePatch(patch);
    const updated = {
      ...patch,
      status: validation.status,
      validationResults: validation.results,
      resolvedAt: validation.status === "accepted" ? nowIso() : undefined
    };
    await this.store.updatePatch(updated);
    if (updated.status === "accepted") {
      await this.applyPatch(updated, "validation-agent-v1");
    }
    return updated;
  }

  async applyPatch(patch: GraphPatch, actorId: string): Promise<void> {
    for (const operation of patch.operations) {
      if (operation.op === "create_node") {
        const existing = await this.store.getNode(operation.node.id);
        if (!existing) await this.store.createNode(operation.node);
      }
      if (operation.op === "create_assertion") {
        await this.store.createAssertion({
          ...operation.assertion,
          status: "accepted",
          memoryState: operation.assertion.memoryState === "sensitive" ? "sensitive" : "observed",
          acceptedBy: actorId,
          updatedAt: nowIso()
        });
      }
      if (operation.op === "mark_node") {
        const node = await this.store.getNode(operation.nodeId);
        if (node) {
          await this.store.updateNode({
            ...node,
            memoryState: operation.memoryState,
            memoryScope: operation.memoryScope ?? node.memoryScope,
            updatedAt: nowIso()
          });
        }
      }
      if (operation.op === "mark_assertion") {
        const assertion = await this.store.getAssertion(operation.assertionId);
        if (assertion) {
          await this.store.updateAssertion({
            ...assertion,
            status: operation.status,
            memoryState: operation.memoryState ?? assertion.memoryState,
            updatedAt: nowIso()
          });
        }
      }
    }

    await this.store.createAuditEvent({
      id: newId("audit"),
      eventType: "patch_applied",
      actorId,
      patchId: patch.id,
      targetIds: patch.operations.flatMap((operation) => {
        if (operation.op === "create_node") return [operation.node.id];
        if (operation.op === "create_assertion") return [operation.assertion.id];
        if (operation.op === "mark_node") return [operation.nodeId];
        return [operation.assertionId];
      }),
      reason: patch.reason,
      metadata: { status: patch.status },
      createdAt: nowIso()
    });
  }

  async createQuestionFromPatch(patch: GraphPatch): Promise<Question> {
    const prompt = `Should I remember this? ${patch.reason}`;
    return this.store.createQuestion({
      id: newId("question"),
      questionKind: patch.sensitivity === "high" ? "classify_sensitivity" : "confirm_memory",
      prompt,
      relatedNodeIds: patch.operations.flatMap((operation) =>
        operation.op === "create_node" ? [operation.node.id] : []
      ),
      evidenceIds: patch.evidenceIds,
      priority: patch.sensitivity === "high" ? "high" : "medium",
      status: "open",
      createdBy: "question-agent-v1",
      createdAt: nowIso()
    });
  }

  async acceptPatch(patchId: string, actorId = "user"): Promise<GraphPatch> {
    const patch = await this.store.getPatch(patchId);
    if (!patch) throw new Error(`Patch not found: ${patchId}`);
    const updated: GraphPatch = { ...patch, status: "accepted", resolvedAt: nowIso() };
    await this.store.updatePatch(updated);
    await this.applyPatch(updated, actorId);
    return updated;
  }

  async rejectPatch(patchId: string, actorId = "user"): Promise<GraphPatch> {
    const patch = await this.store.getPatch(patchId);
    if (!patch) throw new Error(`Patch not found: ${patchId}`);
    const updated: GraphPatch = { ...patch, status: "rejected", resolvedAt: nowIso() };
    await this.store.updatePatch(updated);
    await this.store.createAuditEvent({
      id: newId("audit"),
      eventType: "patch_rejected",
      actorId,
      patchId,
      targetIds: [],
      reason: patch.reason,
      metadata: {},
      createdAt: nowIso()
    });
    return updated;
  }

  async answerQuestion(questionId: string, answer: string): Promise<Question> {
    const question = await this.store.getQuestion(questionId);
    if (!question) throw new Error(`Question not found: ${questionId}`);
    const evidence = await this.store.createEvidence({
      id: newId("evidence"),
      type: "user_answer",
      sourceId: question.id,
      locator: `${question.id}#answer`,
      quote: answer,
      metadata: {},
      createdAt: nowIso()
    });
    const updated = { ...question, status: "answered" as const, evidenceIds: [...question.evidenceIds, evidence.id] };
    return this.store.updateQuestion(updated);
  }

  async makeForgetPatch(targetId: string, scope: MemoryScope = "forgotten"): Promise<void> {
    await this.store.forgetMemory(targetId);
    await this.store.createAuditEvent({
      id: newId("audit"),
      eventType: "memory_forgotten",
      actorId: "user",
      targetIds: [targetId],
      reason: `Memory marked ${scope}`,
      metadata: { scope },
      createdAt: nowIso()
    });
  }
}

