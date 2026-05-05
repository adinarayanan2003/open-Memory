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

export type MemoryStore = {
  createSourceConnection(connection: SourceConnection): Promise<SourceConnection>;
  createSourceRecord(record: SourceRecord): Promise<SourceRecord>;
  getSourceRecord(id: string): Promise<SourceRecord | undefined>;
  listSourceRecords(): Promise<SourceRecord[]>;

  createChunks(chunks: Chunk[]): Promise<Chunk[]>;
  getChunksBySourceRecord(sourceRecordId: string): Promise<Chunk[]>;
  getChunk(id: string): Promise<Chunk | undefined>;

  createEvidence(evidence: Evidence): Promise<Evidence>;
  getEvidence(id: string): Promise<Evidence | undefined>;
  listEvidence(ids?: string[]): Promise<Evidence[]>;

  createNode(node: Node): Promise<Node>;
  findNodeByLabel(type: Node["type"], label: string): Promise<Node | undefined>;
  getNode(id: string): Promise<Node | undefined>;
  listNodes(): Promise<Node[]>;
  updateNode(node: Node): Promise<Node>;

  createAssertion(assertion: Assertion): Promise<Assertion>;
  getAssertion(id: string): Promise<Assertion | undefined>;
  listAssertions(): Promise<Assertion[]>;
  updateAssertion(assertion: Assertion): Promise<Assertion>;

  createPatch(patch: GraphPatch): Promise<GraphPatch>;
  getPatch(id: string): Promise<GraphPatch | undefined>;
  listPatches(status?: PatchStatus): Promise<GraphPatch[]>;
  updatePatch(patch: GraphPatch): Promise<GraphPatch>;

  createQuestion(question: Question): Promise<Question>;
  getQuestion(id: string): Promise<Question | undefined>;
  listQuestions(status?: Question["status"]): Promise<Question[]>;
  updateQuestion(question: Question): Promise<Question>;

  createAuditEvent(event: AuditEvent): Promise<AuditEvent>;
  listAuditEvents(): Promise<AuditEvent[]>;

  createAgentRun(run: AgentRun): Promise<AgentRun>;
  updateAgentRun(run: AgentRun): Promise<AgentRun>;
  listAgentRuns(): Promise<AgentRun[]>;

  createAgentMemory(record: AgentMemoryRecord): Promise<AgentMemoryRecord>;
  listAgentMemories(): Promise<AgentMemoryRecord[]>;

  forgetMemory(targetId: string): Promise<void>;
  searchText(query: string, allowedScopes: MemoryScope[]): Promise<{
    nodes: Node[];
    assertions: Assertion[];
    evidence: Evidence[];
  }>;
};

