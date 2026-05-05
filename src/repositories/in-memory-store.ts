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
  PatchStatus,
  Question,
  SourceConnection,
  SourceRecord
} from "../domain/types.js";
import type { MemoryStore } from "./memory-store.js";

export class InMemoryStore implements MemoryStore {
  private sourceConnections = new Map<string, SourceConnection>();
  private sourceRecords = new Map<string, SourceRecord>();
  private chunks = new Map<string, Chunk>();
  private evidence = new Map<string, Evidence>();
  private nodes = new Map<string, Node>();
  private assertions = new Map<string, Assertion>();
  private patches = new Map<string, GraphPatch>();
  private questions = new Map<string, Question>();
  private auditEvents = new Map<string, AuditEvent>();
  private agentRuns = new Map<string, AgentRun>();
  private agentMemories = new Map<string, AgentMemoryRecord>();

  async createSourceConnection(connection: SourceConnection) {
    this.sourceConnections.set(connection.id, connection);
    return connection;
  }

  async createSourceRecord(record: SourceRecord) {
    this.sourceRecords.set(record.id, record);
    return record;
  }

  async getSourceRecord(id: string) {
    return this.sourceRecords.get(id);
  }

  async listSourceRecords() {
    return [...this.sourceRecords.values()];
  }

  async createChunks(chunks: Chunk[]) {
    for (const chunk of chunks) this.chunks.set(chunk.id, chunk);
    return chunks;
  }

  async getChunksBySourceRecord(sourceRecordId: string) {
    return [...this.chunks.values()].filter((chunk) => chunk.sourceRecordId === sourceRecordId);
  }

  async getChunk(id: string) {
    return this.chunks.get(id);
  }

  async createEvidence(evidence: Evidence) {
    this.evidence.set(evidence.id, evidence);
    return evidence;
  }

  async getEvidence(id: string) {
    return this.evidence.get(id);
  }

  async listEvidence(ids?: string[]) {
    const all = [...this.evidence.values()];
    return ids ? all.filter((item) => ids.includes(item.id)) : all;
  }

  async createNode(node: Node) {
    this.nodes.set(node.id, node);
    return node;
  }

  async findNodeByLabel(type: Node["type"], label: string) {
    const normalized = label.trim().toLowerCase();
    return [...this.nodes.values()].find(
      (node) => node.type === type && node.label.trim().toLowerCase() === normalized
    );
  }

  async getNode(id: string) {
    return this.nodes.get(id);
  }

  async listNodes() {
    return [...this.nodes.values()];
  }

  async updateNode(node: Node) {
    this.nodes.set(node.id, node);
    return node;
  }

  async createAssertion(assertion: Assertion) {
    this.assertions.set(assertion.id, assertion);
    return assertion;
  }

  async getAssertion(id: string) {
    return this.assertions.get(id);
  }

  async listAssertions() {
    return [...this.assertions.values()];
  }

  async updateAssertion(assertion: Assertion) {
    this.assertions.set(assertion.id, assertion);
    return assertion;
  }

  async createPatch(patch: GraphPatch) {
    this.patches.set(patch.id, patch);
    return patch;
  }

  async getPatch(id: string) {
    return this.patches.get(id);
  }

  async listPatches(status?: PatchStatus) {
    const patches = [...this.patches.values()];
    return status ? patches.filter((patch) => patch.status === status) : patches;
  }

  async updatePatch(patch: GraphPatch) {
    this.patches.set(patch.id, patch);
    return patch;
  }

  async createQuestion(question: Question) {
    this.questions.set(question.id, question);
    return question;
  }

  async getQuestion(id: string) {
    return this.questions.get(id);
  }

  async listQuestions(status?: Question["status"]) {
    const questions = [...this.questions.values()];
    return status ? questions.filter((question) => question.status === status) : questions;
  }

  async updateQuestion(question: Question) {
    this.questions.set(question.id, question);
    return question;
  }

  async createAuditEvent(event: AuditEvent) {
    this.auditEvents.set(event.id, event);
    return event;
  }

  async listAuditEvents() {
    return [...this.auditEvents.values()];
  }

  async createAgentRun(run: AgentRun) {
    this.agentRuns.set(run.id, run);
    return run;
  }

  async updateAgentRun(run: AgentRun) {
    this.agentRuns.set(run.id, run);
    return run;
  }

  async listAgentRuns() {
    return [...this.agentRuns.values()];
  }

  async createAgentMemory(record: AgentMemoryRecord) {
    this.agentMemories.set(record.id, record);
    return record;
  }

  async listAgentMemories() {
    return [...this.agentMemories.values()];
  }

  async forgetMemory(targetId: string) {
    const node = this.nodes.get(targetId);
    if (node) {
      await this.updateNode({ ...node, memoryState: "forgotten", memoryScope: "forgotten" });
      for (const assertion of this.assertions.values()) {
        if (assertion.subjectNodeId === targetId || assertion.objectNodeId === targetId) {
          await this.updateAssertion({
            ...assertion,
            status: "superseded",
            memoryState: "forgotten",
            memoryScope: "forgotten"
          });
        }
      }
    }

    const assertion = this.assertions.get(targetId);
    if (assertion) {
      await this.updateAssertion({
        ...assertion,
        status: "superseded",
        memoryState: "forgotten",
        memoryScope: "forgotten"
      });
    }
  }

  async searchText(query: string, allowedScopes: MemoryScope[]) {
    const q = query.trim().toLowerCase();
    const nodes = [...this.nodes.values()].filter(
      (node) =>
        canRetrieve(node.memoryScope, allowedScopes) &&
        node.memoryState !== "forgotten" &&
        `${node.label} ${node.summary ?? ""}`.toLowerCase().includes(q)
    );
    const assertions = [...this.assertions.values()].filter(
      (assertion) =>
        assertion.status === "accepted" &&
        canRetrieve(assertion.memoryScope, allowedScopes) &&
        assertion.memoryState !== "forgotten" &&
        JSON.stringify(assertion).toLowerCase().includes(q)
    );
    const evidence = [...this.evidence.values()].filter((item) =>
      `${item.quote ?? ""} ${JSON.stringify(item.metadata)}`.toLowerCase().includes(q)
    );
    return { nodes, assertions, evidence };
  }
}
