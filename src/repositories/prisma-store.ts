import { Prisma, PrismaClient } from "@prisma/client";
import { canRetrieve } from "../domain/policies.js";
import type {
  AgentMemoryRecord,
  AgentRun,
  Assertion,
  AuditEvent,
  Chunk,
  Evidence,
  GraphPatch,
  MemoryScope,
  Node,
  PatchOperation,
  PatchStatus,
  Question,
  SourceConnection,
  SourceRecord
} from "../domain/types.js";
import type { MemoryStore } from "./memory-store.js";

type PrismaSourceConnection = Prisma.SourceConnectionGetPayload<Record<string, never>>;
type PrismaSourceRecord = Prisma.SourceRecordGetPayload<Record<string, never>>;
type PrismaChunk = Prisma.ChunkGetPayload<Record<string, never>>;
type PrismaNode = Prisma.NodeGetPayload<Record<string, never>>;
type PrismaEvidence = Prisma.EvidenceGetPayload<Record<string, never>>;
type PrismaAssertion = Prisma.AssertionGetPayload<Record<string, never>>;
type PrismaGraphPatch = Prisma.GraphPatchGetPayload<Record<string, never>>;
type PrismaQuestion = Prisma.QuestionGetPayload<Record<string, never>>;
type PrismaAuditEvent = Prisma.AuditEventGetPayload<Record<string, never>>;
type PrismaAgentRun = Prisma.AgentRunGetPayload<Record<string, never>>;
type PrismaAgentMemoryRecord = Prisma.AgentMemoryRecordGetPayload<Record<string, never>>;

export class PrismaMemoryStore implements MemoryStore {
  constructor(readonly prisma: PrismaClient) {}

  async createSourceConnection(connection: SourceConnection) {
    const record = await this.prisma.sourceConnection.create({
      data: {
        ...connection,
        lastSyncedAt: toDate(connection.lastSyncedAt),
        createdAt: toDate(connection.createdAt) ?? new Date()
      }
    });
    return toSourceConnection(record);
  }

  async createSourceRecord(record: SourceRecord) {
    const created = await this.prisma.sourceRecord.create({
      data: {
        ...record,
        metadata: toJson(record.metadata),
        createdAtSource: toDate(record.createdAtSource),
        updatedAtSource: toDate(record.updatedAtSource),
        fetchedAt: toDate(record.fetchedAt) ?? new Date()
      }
    });
    return toSourceRecord(created);
  }

  async getSourceRecord(id: string) {
    const record = await this.prisma.sourceRecord.findUnique({ where: { id } });
    return record ? toSourceRecord(record) : undefined;
  }

  async listSourceRecords() {
    const records = await this.prisma.sourceRecord.findMany({ orderBy: { fetchedAt: "asc" } });
    return records.map(toSourceRecord);
  }

  async createChunks(chunks: Chunk[]) {
    if (!chunks.length) return [];
    await this.prisma.chunk.createMany({
      data: chunks.map((chunk) => ({
        ...chunk,
        metadata: toJson(chunk.metadata),
        createdAt: toDate(chunk.createdAt) ?? new Date()
      }))
    });
    return chunks;
  }

  async getChunksBySourceRecord(sourceRecordId: string) {
    const records = await this.prisma.chunk.findMany({ where: { sourceRecordId }, orderBy: { ordinal: "asc" } });
    return records.map(toChunk);
  }

  async getChunk(id: string) {
    const record = await this.prisma.chunk.findUnique({ where: { id } });
    return record ? toChunk(record) : undefined;
  }

  async createEvidence(evidence: Evidence) {
    const record = await this.prisma.evidence.create({
      data: {
        ...evidence,
        metadata: toJson(evidence.metadata),
        createdAt: toDate(evidence.createdAt) ?? new Date()
      }
    });
    return toEvidence(record);
  }

  async getEvidence(id: string) {
    const record = await this.prisma.evidence.findUnique({ where: { id } });
    return record ? toEvidence(record) : undefined;
  }

  async listEvidence(ids?: string[]) {
    const records = await this.prisma.evidence.findMany({
      where: ids ? { id: { in: ids } } : undefined,
      orderBy: { createdAt: "asc" }
    });
    return records.map(toEvidence);
  }

  async createNode(node: Node) {
    const record = await this.prisma.node.create({
      data: {
        ...node,
        attributes: toJson(node.attributes),
        createdAt: toDate(node.createdAt) ?? new Date(),
        updatedAt: toDate(node.updatedAt) ?? new Date()
      }
    });
    return toNode(record);
  }

  async findNodeByLabel(type: Node["type"], label: string) {
    const record = await this.prisma.node.findFirst({
      where: { type, label: { equals: label.trim(), mode: "insensitive" } },
      orderBy: { createdAt: "asc" }
    });
    return record ? toNode(record) : undefined;
  }

  async getNode(id: string) {
    const record = await this.prisma.node.findUnique({ where: { id } });
    return record ? toNode(record) : undefined;
  }

  async listNodes() {
    const records = await this.prisma.node.findMany({ orderBy: { createdAt: "asc" } });
    return records.map(toNode);
  }

  async updateNode(node: Node) {
    const record = await this.prisma.node.update({
      where: { id: node.id },
      data: {
        type: node.type,
        label: node.label,
        summary: node.summary,
        attributes: toJson(node.attributes),
        memoryState: node.memoryState,
        memoryScope: node.memoryScope,
        currentVersion: node.currentVersion,
        updatedAt: toDate(node.updatedAt) ?? new Date()
      }
    });
    return toNode(record);
  }

  async createAssertion(assertion: Assertion) {
    const record = await this.prisma.assertion.create({
      data: {
        id: assertion.id,
        subjectNodeId: assertion.subjectNodeId,
        predicate: assertion.predicate,
        objectNodeId: assertion.objectNodeId,
        ...(assertion.literalValue === undefined ? {} : { literalValue: toJson(assertion.literalValue) }),
        qualifiers: toJson(assertion.qualifiers),
        evidenceIds: assertion.evidenceIds,
        confidence: assertion.confidence,
        status: assertion.status,
        memoryState: assertion.memoryState,
        memoryScope: assertion.memoryScope,
        createdBy: assertion.createdBy,
        acceptedBy: assertion.acceptedBy,
        currentVersion: assertion.currentVersion,
        createdAt: toDate(assertion.createdAt) ?? new Date(),
        updatedAt: toDate(assertion.updatedAt) ?? new Date()
      }
    });
    return toAssertion(record);
  }

  async getAssertion(id: string) {
    const record = await this.prisma.assertion.findUnique({ where: { id } });
    return record ? toAssertion(record) : undefined;
  }

  async listAssertions() {
    const records = await this.prisma.assertion.findMany({ orderBy: { createdAt: "asc" } });
    return records.map(toAssertion);
  }

  async updateAssertion(assertion: Assertion) {
    const record = await this.prisma.assertion.update({
      where: { id: assertion.id },
      data: {
        subjectNodeId: assertion.subjectNodeId,
        predicate: assertion.predicate,
        objectNodeId: assertion.objectNodeId,
        literalValue: assertion.literalValue === undefined ? Prisma.JsonNull : toJson(assertion.literalValue),
        qualifiers: toJson(assertion.qualifiers),
        evidenceIds: assertion.evidenceIds,
        confidence: assertion.confidence,
        status: assertion.status,
        memoryState: assertion.memoryState,
        memoryScope: assertion.memoryScope,
        createdBy: assertion.createdBy,
        acceptedBy: assertion.acceptedBy,
        currentVersion: assertion.currentVersion,
        updatedAt: toDate(assertion.updatedAt) ?? new Date()
      }
    });
    return toAssertion(record);
  }

  async createPatch(patch: GraphPatch) {
    const record = await this.prisma.graphPatch.create({
      data: {
        ...patch,
        operations: toJson(patch.operations),
        validationResults: toJson(patch.validationResults),
        createdAt: toDate(patch.createdAt) ?? new Date(),
        resolvedAt: toDate(patch.resolvedAt)
      }
    });
    return toGraphPatch(record);
  }

  async getPatch(id: string) {
    const record = await this.prisma.graphPatch.findUnique({ where: { id } });
    return record ? toGraphPatch(record) : undefined;
  }

  async listPatches(status?: PatchStatus) {
    const records = await this.prisma.graphPatch.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "asc" }
    });
    return records.map(toGraphPatch);
  }

  async updatePatch(patch: GraphPatch) {
    const record = await this.prisma.graphPatch.update({
      where: { id: patch.id },
      data: {
        proposedBy: patch.proposedBy,
        reason: patch.reason,
        operations: toJson(patch.operations),
        evidenceIds: patch.evidenceIds,
        confidence: patch.confidence,
        sensitivity: patch.sensitivity,
        suggestedScope: patch.suggestedScope,
        validationResults: toJson(patch.validationResults),
        status: patch.status,
        resolvedAt: toDate(patch.resolvedAt)
      }
    });
    return toGraphPatch(record);
  }

  async createQuestion(question: Question) {
    const record = await this.prisma.question.create({
      data: {
        ...question,
        createdAt: toDate(question.createdAt) ?? new Date()
      }
    });
    return toQuestion(record);
  }

  async getQuestion(id: string) {
    const record = await this.prisma.question.findUnique({ where: { id } });
    return record ? toQuestion(record) : undefined;
  }

  async listQuestions(status?: Question["status"]) {
    const records = await this.prisma.question.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "asc" }
    });
    return records.map(toQuestion);
  }

  async updateQuestion(question: Question) {
    const record = await this.prisma.question.update({
      where: { id: question.id },
      data: {
        questionKind: question.questionKind,
        prompt: question.prompt,
        relatedNodeIds: question.relatedNodeIds,
        evidenceIds: question.evidenceIds,
        priority: question.priority,
        status: question.status,
        createdBy: question.createdBy
      }
    });
    return toQuestion(record);
  }

  async createAuditEvent(event: AuditEvent) {
    const record = await this.prisma.auditEvent.create({
      data: {
        ...event,
        metadata: toJson(event.metadata),
        createdAt: toDate(event.createdAt) ?? new Date()
      }
    });
    return toAuditEvent(record);
  }

  async listAuditEvents() {
    const records = await this.prisma.auditEvent.findMany({ orderBy: { createdAt: "asc" } });
    return records.map(toAuditEvent);
  }

  async createAgentRun(run: AgentRun) {
    const record = await this.prisma.agentRun.create({
      data: {
        ...run,
        startedAt: toDate(run.startedAt) ?? new Date(),
        finishedAt: toDate(run.finishedAt)
      }
    });
    return toAgentRun(record);
  }

  async updateAgentRun(run: AgentRun) {
    const record = await this.prisma.agentRun.update({
      where: { id: run.id },
      data: {
        agentId: run.agentId,
        userId: run.userId,
        taskType: run.taskType,
        inputRefs: run.inputRefs,
        outputPatchIds: run.outputPatchIds,
        questionIds: run.questionIds,
        toolsUsed: run.toolsUsed,
        modelVersion: run.modelVersion,
        promptVersion: run.promptVersion,
        policyVersion: run.policyVersion,
        status: run.status,
        errorSummary: run.errorSummary,
        evaluatorFeedback: run.evaluatorFeedback,
        finishedAt: toDate(run.finishedAt)
      }
    });
    return toAgentRun(record);
  }

  async listAgentRuns() {
    const records = await this.prisma.agentRun.findMany({ orderBy: { startedAt: "asc" } });
    return records.map(toAgentRun);
  }

  async createAgentMemory(record: AgentMemoryRecord) {
    const created = await this.prisma.agentMemoryRecord.create({
      data: {
        ...record,
        expiresAt: toDate(record.expiresAt),
        createdAt: toDate(record.createdAt) ?? new Date(),
        updatedAt: toDate(record.updatedAt) ?? new Date()
      }
    });
    return toAgentMemoryRecord(created);
  }

  async listAgentMemories() {
    const records = await this.prisma.agentMemoryRecord.findMany({ orderBy: { createdAt: "asc" } });
    return records.map(toAgentMemoryRecord);
  }

  async forgetMemory(targetId: string) {
    await this.prisma.$transaction(async (tx) => {
      const node = await tx.node.findUnique({ where: { id: targetId } });
      if (node) {
        await tx.node.update({
          where: { id: targetId },
          data: { memoryState: "forgotten", memoryScope: "forgotten", updatedAt: new Date() }
        });
        await tx.assertion.updateMany({
          where: { OR: [{ subjectNodeId: targetId }, { objectNodeId: targetId }] },
          data: { status: "superseded", memoryState: "forgotten", memoryScope: "forgotten", updatedAt: new Date() }
        });
      }

      const assertion = await tx.assertion.findUnique({ where: { id: targetId } });
      if (assertion) {
        await tx.assertion.update({
          where: { id: targetId },
          data: { status: "superseded", memoryState: "forgotten", memoryScope: "forgotten", updatedAt: new Date() }
        });
      }
    });
  }

  async searchText(query: string, allowedScopes: MemoryScope[]) {
    const q = query.trim();
    const nodes = await this.prisma.node.findMany({
      where: {
        memoryState: { not: "forgotten" },
        memoryScope: { in: allowedScopes },
        OR: [
          { label: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } }
        ]
      },
      orderBy: { createdAt: "asc" }
    });

    const assertionRecords = await this.prisma.assertion.findMany({
      where: {
        status: "accepted",
        memoryState: { not: "forgotten" },
        memoryScope: { in: allowedScopes }
      },
      orderBy: { createdAt: "asc" }
    });
    const assertions = assertionRecords
      .map(toAssertion)
      .filter(
        (assertion) =>
          canRetrieve(assertion.memoryScope, allowedScopes) &&
          JSON.stringify(assertion).toLowerCase().includes(q.toLowerCase())
      );

    const evidenceRecords = await this.prisma.evidence.findMany({ orderBy: { createdAt: "asc" } });
    const evidence = evidenceRecords
      .map(toEvidence)
      .filter((item) => `${item.quote ?? ""} ${JSON.stringify(item.metadata)}`.toLowerCase().includes(q.toLowerCase()));

    return { nodes: nodes.map(toNode), assertions, evidence };
  }
}

function toDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toSourceConnection(record: PrismaSourceConnection): SourceConnection {
  return {
    ...record,
    lastSyncedAt: record.lastSyncedAt?.toISOString(),
    createdAt: record.createdAt.toISOString()
  };
}

function toSourceRecord(record: PrismaSourceRecord): SourceRecord {
  return {
    ...record,
    title: record.title ?? undefined,
    author: record.author ?? undefined,
    rawObjectRef: record.rawObjectRef ?? undefined,
    createdAtSource: record.createdAtSource?.toISOString(),
    updatedAtSource: record.updatedAtSource?.toISOString(),
    fetchedAt: record.fetchedAt.toISOString(),
    contentType: record.contentType as SourceRecord["contentType"],
    memoryScopeTags: record.memoryScopeTags as MemoryScope[],
    sensitivityTags: record.sensitivityTags as SourceRecord["sensitivityTags"],
    metadata: toJsonObject(record.metadata)
  };
}

function toChunk(record: PrismaChunk): Chunk {
  return { ...record, metadata: toJsonObject(record.metadata), createdAt: record.createdAt.toISOString() };
}

function toNode(record: PrismaNode): Node {
  return {
    ...record,
    type: record.type as Node["type"],
    summary: record.summary ?? undefined,
    attributes: toJsonObject(record.attributes),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toEvidence(record: PrismaEvidence): Evidence {
  return {
    ...record,
    type: record.type as Evidence["type"],
    quote: record.quote ?? undefined,
    metadata: toJsonObject(record.metadata),
    createdAt: record.createdAt.toISOString()
  };
}

function toAssertion(record: PrismaAssertion): Assertion {
  return {
    ...record,
    predicate: record.predicate as Assertion["predicate"],
    objectNodeId: record.objectNodeId ?? undefined,
    literalValue: record.literalValue === null ? undefined : record.literalValue,
    qualifiers: toJsonObject(record.qualifiers),
    acceptedBy: record.acceptedBy ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toGraphPatch(record: PrismaGraphPatch): GraphPatch {
  return {
    ...record,
    operations: record.operations as unknown as PatchOperation[],
    validationResults: Array.isArray(record.validationResults)
      ? (record.validationResults as GraphPatch["validationResults"])
      : [],
    sensitivity: record.sensitivity as GraphPatch["sensitivity"],
    createdAt: record.createdAt.toISOString(),
    resolvedAt: record.resolvedAt?.toISOString()
  };
}

function toQuestion(record: PrismaQuestion): Question {
  return {
    ...record,
    questionKind: record.questionKind as Question["questionKind"],
    priority: record.priority as Question["priority"],
    status: record.status as Question["status"],
    createdAt: record.createdAt.toISOString()
  };
}

function toAuditEvent(record: PrismaAuditEvent): AuditEvent {
  return {
    ...record,
    patchId: record.patchId ?? undefined,
    reason: record.reason ?? undefined,
    metadata: toJsonObject(record.metadata),
    createdAt: record.createdAt.toISOString()
  };
}

function toAgentRun(record: PrismaAgentRun): AgentRun {
  return {
    ...record,
    modelVersion: record.modelVersion ?? undefined,
    promptVersion: record.promptVersion ?? undefined,
    errorSummary: record.errorSummary ?? undefined,
    evaluatorFeedback: record.evaluatorFeedback ?? undefined,
    startedAt: record.startedAt.toISOString(),
    finishedAt: record.finishedAt?.toISOString()
  };
}

function toAgentMemoryRecord(record: PrismaAgentMemoryRecord): AgentMemoryRecord {
  return {
    ...record,
    memoryKind: record.memoryKind as AgentMemoryRecord["memoryKind"],
    scope: record.scope as AgentMemoryRecord["scope"],
    sensitivity: record.sensitivity as AgentMemoryRecord["sensitivity"],
    expiresAt: record.expiresAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
