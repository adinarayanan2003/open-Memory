export type SourceConnectionType = "manual" | "file_upload" | "notes";
export type SyncMode = "one_time" | "scheduled" | "webhook" | "continuous";
export type ConnectionStatus = "active" | "paused" | "error" | "revoked";

export type MemoryState =
  | "observed"
  | "inferred"
  | "confirmed"
  | "sensitive"
  | "stale"
  | "forgotten";

export type MemoryScope =
  | "available_to_assistant"
  | "search_only"
  | "only_when_explicitly_asked"
  | "private_do_not_use"
  | "time_limited"
  | "forgotten";

export type PatchStatus = "pending" | "accepted" | "rejected" | "needs_review";
export type AssertionStatus = "proposed" | "accepted" | "rejected" | "superseded" | "contradicted";
export type AgentRunStatus = "queued" | "running" | "succeeded" | "failed" | "partial" | "blocked";

export type NodeType =
  | "Source"
  | "Document"
  | "Chunk"
  | "Memory"
  | "Project"
  | "Preference"
  | "Decision"
  | "OpenLoop"
  | "Question"
  | "Person"
  | "Topic";

export type Predicate =
  | "mentions"
  | "related_to"
  | "working_on"
  | "prefers"
  | "decided"
  | "committed_to"
  | "supports"
  | "contradicts"
  | "supersedes"
  | "has_evidence"
  | "needs_confirmation_from";

export type Sensitivity = "low" | "medium" | "high";
export type QuestionPriority = "low" | "medium" | "high" | "critical";

export type SourceConnection = {
  id: string;
  type: SourceConnectionType;
  displayName: string;
  ownerUserId: string;
  syncMode: SyncMode;
  memoryScopePolicyId: string;
  retentionPolicyId: string;
  status: ConnectionStatus;
  lastSyncedAt?: string;
  createdAt: string;
};

export type SourceRecord = {
  id: string;
  connectionId: string;
  sourceType: string;
  externalId: string;
  title?: string;
  author?: string;
  participants: string[];
  createdAtSource?: string;
  updatedAtSource?: string;
  fetchedAt: string;
  contentType: "note" | "document" | "file" | "manual";
  rawObjectRef?: string;
  text: string;
  memoryScopeTags: MemoryScope[];
  sensitivityTags: Sensitivity[];
  metadata: Record<string, unknown>;
};

export type Chunk = {
  id: string;
  sourceRecordId: string;
  text: string;
  ordinal: number;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type Node = {
  id: string;
  type: NodeType;
  label: string;
  summary?: string;
  attributes: Record<string, unknown>;
  memoryState: MemoryState;
  memoryScope: MemoryScope;
  currentVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type Evidence = {
  id: string;
  type: "chunk" | "source_record" | "user_answer";
  sourceId: string;
  locator: string;
  quote?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type Assertion = {
  id: string;
  subjectNodeId: string;
  predicate: Predicate;
  objectNodeId?: string;
  literalValue?: unknown;
  qualifiers: Record<string, unknown>;
  evidenceIds: string[];
  confidence: number;
  status: AssertionStatus;
  memoryState: MemoryState;
  memoryScope: MemoryScope;
  createdBy: string;
  acceptedBy?: string;
  currentVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type PatchOperation =
  | { op: "create_node"; node: Node }
  | { op: "create_assertion"; assertion: Assertion }
  | { op: "mark_assertion"; assertionId: string; status: AssertionStatus; memoryState?: MemoryState }
  | { op: "mark_node"; nodeId: string; memoryState: MemoryState; memoryScope?: MemoryScope };

export type ValidationResult = {
  rule: string;
  passed: boolean;
  message: string;
};

export type GraphPatch = {
  id: string;
  proposedBy: string;
  reason: string;
  operations: PatchOperation[];
  evidenceIds: string[];
  confidence: number;
  sensitivity: Sensitivity;
  suggestedScope: MemoryScope;
  validationResults: ValidationResult[];
  status: PatchStatus;
  createdAt: string;
  resolvedAt?: string;
};

export type Question = {
  id: string;
  questionKind:
    | "confirm_memory"
    | "confirm_preference"
    | "clarify_rationale"
    | "confirm_commitment"
    | "classify_sensitivity";
  prompt: string;
  relatedNodeIds: string[];
  evidenceIds: string[];
  priority: QuestionPriority;
  status: "open" | "answered" | "dismissed" | "expired";
  createdBy: string;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  eventType: string;
  actorId: string;
  patchId?: string;
  targetIds: string[];
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AgentRun = {
  id: string;
  agentId: string;
  userId: string;
  taskType: string;
  inputRefs: string[];
  outputPatchIds: string[];
  questionIds: string[];
  toolsUsed: string[];
  modelVersion?: string;
  promptVersion?: string;
  policyVersion: string;
  status: AgentRunStatus;
  errorSummary?: string;
  evaluatorFeedback?: string;
  startedAt: string;
  finishedAt?: string;
};

export type AgentMemoryRecord = {
  id: string;
  agentId: string;
  userId: string;
  memoryKind:
    | "run_outcome"
    | "user_feedback"
    | "heuristic"
    | "failure_pattern"
    | "confidence_calibration"
    | "tool_performance"
    | "question_preference"
    | "schema_lesson";
  summary: string;
  sourceRunIds: string[];
  relatedPolicyIds: string[];
  scope: "agent_only" | "agent_type_for_user" | "user_agents" | "global_anonymized";
  sensitivity: Sensitivity;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExtractionCandidate = {
  kind: "project" | "preference" | "decision" | "open_loop" | "person" | "topic" | "memory";
  label: string;
  summary: string;
  evidenceChunkIds: string[];
  confidence: number;
  sensitivity: Sensitivity;
  suggestedScope: MemoryScope;
};

export type ProposedQuestion = {
  kind: Question["questionKind"];
  prompt: string;
  evidenceChunkIds: string[];
  priority: Exclude<QuestionPriority, "critical">;
};

export type ExtractionOutput = {
  candidates: ExtractionCandidate[];
  proposedQuestions: ProposedQuestion[];
};

export type PersonalMemoryPackage = {
  query: string;
  answer?: string;
  nodes: Node[];
  assertions: Assertion[];
  evidence: Evidence[];
  sourceSnippets: Array<{
    evidenceId: string;
    text: string;
    sourceRecordId: string;
  }>;
  confidence: "low" | "medium" | "high";
  memoryStates: MemoryState[];
  openQuestions: Question[];
};

