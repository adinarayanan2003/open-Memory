# System Design Plan: Agentic Company Memory

## 1. Product Goal

Build a company memory system where users can connect sources such as Slack, email, files, databases, ticketing systems, code repositories, and external APIs. Always-running agents ingest these sources, construct a typed knowledge graph, and ask humans for clarification when the system detects uncertain decisions, missing rationale, conflicting claims, or incomplete ownership.

The system should not claim to know everything. It should continuously maintain what is known, what is inferred, what is contradicted, and what needs human confirmation.

Core product promise:

```text
A universal memory for teams that reads the workstream,
builds an evidence-backed knowledge graph,
and asks the right humans when important context is missing.
```

## 2. Core Design Principle

The system must separate four states of knowledge:

```text
Observed
The system has direct source evidence.

Inferred
The system sees a likely pattern but lacks direct confirmation.

Disputed
The system has conflicting evidence or competing interpretations.

Unknown
The system has detected a gap and needs human input.
```

This is the central behavior that makes the product trustworthy. Agents should escalate uncertainty into structured questions instead of converting weak signals into facts.

## 3. High-Level Architecture

```text
User / Admin
    |
    v
Connector Setup UI
    |
    v
Source Connectors
Slack, Email, Drive, Notion, GitHub, Jira, Linear, DBs, APIs, Uploads
    |
    v
Ingestion Pipeline
Normalize -> Permission Tag -> Chunk -> Store Raw -> Embed
    |
    v
Knowledge Construction
Node Allocation -> Assertion Proposal -> Evidence Linking -> Validation
    |
    v
Uncertainty Detection
Decision Gaps -> Contradictions -> Missing Owners -> Stale Claims
    |
    v
Human Ask-Back Loop
Question Routing -> Human Confirmation -> Graph Patch -> Audit Event
    |
    v
Company Memory Graph
Typed Nodes + Evidence + Versions + Permissions + Audit Trail
    |
    v
Agentic Retrieval Layer
Query Planning -> Hybrid Retrieval -> Evidence Expansion -> Answer Verification
    |
    v
Interfaces
Search, Q&A, Graph Explorer, Decision Log, Onboarding, Agent Context API

Sidecar:
Agent Private Memory Store
Per-agent run history, feedback, heuristics, failures, and calibration data
```

## 4. User-Facing Source Connection Layer

Users need a simple way to dump or connect company knowledge sources.

### 4.1 Source Types

Initial connector categories:

- File upload: PDFs, Markdown, text files, CSVs, docs exports.
- Cloud files: Google Drive, OneDrive, Dropbox.
- Team communication: Slack, Microsoft Teams, Discord for smaller teams.
- Email: Gmail, Outlook, shared support inboxes.
- Project management: Linear, Jira, Asana, Trello.
- Code and engineering: GitHub, GitLab, Bitbucket, CI logs.
- Documentation: Notion, Confluence, Coda.
- Databases: Postgres, MySQL, SQLite, BigQuery, Snowflake.
- External APIs: customer tools, analytics APIs, CRM APIs, internal services.
- Manual input: notes, decisions, meeting summaries, pasted text.

### 4.2 Connector Setup UX

The setup flow should ask:

- What source do you want to connect?
- Which workspace, folder, channel, repo, table, or API path should be included?
- Who can access knowledge derived from this source?
- Should the connector backfill history or only read new updates?
- Should the source be watched continuously?
- Which data is sensitive and should never be used for broad answers?

Each connector should produce a `SourceConnection` record:

```ts
type SourceConnection = {
  id: string;
  type:
    | "slack"
    | "email"
    | "file_upload"
    | "cloud_drive"
    | "github"
    | "linear"
    | "jira"
    | "notion"
    | "database"
    | "external_api";
  displayName: string;
  ownerUserId: string;
  organizationId: string;
  syncMode: "one_time" | "scheduled" | "webhook" | "continuous";
  permissionPolicyId: string;
  retentionPolicyId: string;
  status: "active" | "paused" | "error" | "revoked";
  lastSyncedAt?: string;
  createdAt: string;
};
```

## 5. Connector Runtime Design

Each connector should follow the same runtime contract.

```text
Fetch raw events/documents
-> Normalize into source records
-> Apply permissions and sensitivity tags
-> Store immutable raw snapshot
-> Emit ingestion jobs
```

### 5.1 Normalized Source Record

```ts
type SourceRecord = {
  id: string;
  connectionId: string;
  sourceType: string;
  externalId: string;
  uri?: string;
  title?: string;
  author?: string;
  participants: string[];
  createdAtSource?: string;
  updatedAtSource?: string;
  fetchedAt: string;
  contentType:
    | "message"
    | "thread"
    | "email"
    | "document"
    | "ticket"
    | "pull_request"
    | "database_row"
    | "api_response"
    | "meeting_note"
    | "file";
  rawObjectRef: string;
  textRef?: string;
  permissionTags: string[];
  sensitivityTags: string[];
  metadata: Record<string, unknown>;
};
```

### 5.2 Connector Requirements

Every connector must support:

- Incremental sync.
- Backfill with limits.
- Retry and rate-limit handling.
- Source deletion/revocation handling.
- Permission propagation.
- Raw snapshot retention policy.
- Stable external IDs.
- Audit logs for sync activity.

## 6. Knowledge Graph Model

The graph should follow the model from `AGENTIC_KNOWLEDGE_GRAPH_SPEC.md`, with company-memory-specific node types.

### 6.1 Core Node Types

- `Person`
- `Team`
- `Project`
- `Customer`
- `Source`
- `Document`
- `Message`
- `Thread`
- `Meeting`
- `Ticket`
- `PullRequest`
- `CodeModule`
- `Database`
- `Table`
- `Metric`
- `Decision`
- `DecisionGap`
- `Claim`
- `Question`
- `Task`
- `Incident`
- `Policy`
- `API`

### 6.2 Core Predicates

- `mentions`
- `authored_by`
- `participated_in`
- `owned_by`
- `belongs_to`
- `depends_on`
- `supports`
- `contradicts`
- `supersedes`
- `implements`
- `requested_by`
- `caused_by`
- `resolved_by`
- `blocks`
- `decided_in`
- `needs_confirmation_from`
- `has_evidence`

### 6.3 Company Memory Assertion Example

```ts
type Assertion = {
  id: "assertion_123";
  subjectNodeId: "project_billing_v2";
  predicate: "owned_by";
  objectNodeId: "person_alice";
  evidenceIds: [
    "evidence_slack_thread_456",
    "evidence_linear_issue_789"
  ];
  confidence: 0.78;
  status: "accepted";
  createdBy: "agent_node_allocator_v1";
  acceptedBy: "validator_policy_v1";
  validFrom: "2026-04-30T00:00:00Z";
  currentVersion: "v3";
  createdAt: "2026-04-30T10:30:00Z";
  updatedAt: "2026-04-30T10:30:00Z";
};
```

## 7. Human Ask-Back Loop

The human ask-back loop is a first-class system component, not a fallback.

### 7.1 When the System Should Ask Humans

Agents should create questions when they detect:

- A likely decision without explicit confirmation.
- A project direction change without rationale.
- A merged PR that appears to implement an undocumented decision.
- A stale owner or ambiguous ownership.
- Conflicting claims from different sources.
- A customer commitment mentioned in conversation but not in the roadmap.
- A recurring topic with no canonical document.
- A task/ticket closed without linked resolution.
- A policy change communicated informally.
- A high-impact claim with weak evidence.

### 7.2 Question Node

```ts
type QuestionNode = {
  id: string;
  type: "Question";
  questionKind:
    | "confirm_decision"
    | "clarify_rationale"
    | "confirm_owner"
    | "resolve_contradiction"
    | "classify_source"
    | "approve_schema_change"
    | "fill_missing_context";
  prompt: string;
  relatedNodeIds: string[];
  evidenceIds: string[];
  suggestedRespondentIds: string[];
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "answered" | "dismissed" | "expired";
  dueAt?: string;
  createdBy: string;
  createdAt: string;
};
```

### 7.3 Ask-Back Examples

Decision confirmation:

```text
It looks like the billing migration plan changed after this Slack thread and PR #341.
Was the final decision to move invoices to the new ledger service?
```

Ownership confirmation:

```text
The system sees Alice, Ravi, and Maya all mentioned as owners of the onboarding flow.
Who is the current owner?
```

Rationale clarification:

```text
The old API gateway plan appears to have been abandoned.
What was the main reason?
```

Contradiction resolution:

```text
Notion says the beta launches in May, but the latest Linear roadmap says July.
Which one is current?
```

### 7.4 Human Answer Handling

Human answers should become graph patches, not loose comments.

```text
Human answers question
-> System creates evidence from answer
-> Agent proposes graph patch
-> Validator checks permissions and schema
-> Accepted patch updates graph
-> Question node is marked answered
-> Audit event records who answered and what changed
```

## 8. Agent System

### 8.1 Connector Agents

Maintain syncs with external systems.

Responsibilities:

- Fetch updates.
- Normalize records.
- Respect permissions.
- Detect connector errors.
- Emit ingestion jobs.

### 8.2 Ingestion Agents

Convert source records into chunks, evidence, and candidate nodes.

Responsibilities:

- Chunk text.
- Extract entities.
- Extract candidate claims.
- Create source/document/message/ticket nodes.
- Generate embeddings.

### 8.3 Node Allocation Agents

Decide whether extracted objects should create new nodes or attach to existing ones.

Responsibilities:

- Entity resolution.
- Alias detection.
- Deduplication.
- Canonical node selection.

### 8.4 Assertion Agents

Create typed relationship proposals.

Responsibilities:

- Propose assertions.
- Attach evidence.
- Estimate confidence.
- Mark weak claims as inferred, not observed.

### 8.5 Uncertainty Agents

Detect ambiguity and missing context.

Responsibilities:

- Create `DecisionGap` nodes.
- Create `Question` nodes.
- Route questions to likely respondents.
- Escalate high-impact uncertainty.

### 8.6 Contradiction Agents

Detect conflicting knowledge.

Responsibilities:

- Compare claims across sources.
- Detect stale docs.
- Identify conflicting roadmaps, owners, policies, and commitments.
- Request human resolution when needed.

### 8.7 Freshness Agents

Maintain time-sensitive knowledge.

Responsibilities:

- Revalidate old claims.
- Mark stale ownership.
- Detect abandoned projects.
- Reopen questions when evidence changes.

### 8.8 Projection Agents

Turn graph state into useful human-readable outputs.

Responsibilities:

- Generate project memory pages.
- Generate decision logs.
- Generate onboarding briefs.
- Generate weekly change summaries.
- Generate "what changed?" reports.

### 8.9 Retrieval Agents

Retrieve evidence-backed graph state for users and downstream agents.

Responsibilities:

- Classify query intent.
- Choose retrieval strategies.
- Run graph, vector, lexical, structured, and audit-history lookups.
- Expand candidate results into evidence-backed knowledge packages.
- Apply permission filters before and after retrieval.
- Rank accepted, human-confirmed, fresh, and well-evidenced knowledge above weak matches.
- Surface disputed, stale, inferred, and unknown states in the answer.
- Create new `Question` nodes when retrieval reveals missing context.

Retrieval agents should not behave like plain RAG. They should retrieve graph state, evidence, uncertainty, and audit history.

## 9. Agent Private Memory

Each agent should have its own private operational memory that improves the agent over time. This memory is separate from company memory.

Important boundary:

```text
Company memory stores organizational knowledge.
Agent private memory stores how an agent learns to do its job better.
```

Agent private memory should not be used as direct evidence for company facts. It can improve future behavior, routing, confidence calibration, and tool choice, but accepted company knowledge must still come from source evidence, human answers, and audited graph patches.

### 9.1 What Agent Private Memory Stores

Agent memory can store:

- Past task outcomes.
- Successful and failed retrieval plans.
- Connector-specific sync issues.
- Extraction mistakes and corrections.
- Human feedback on agent proposals.
- Confidence calibration history.
- Preferred chunking or parsing strategies for a source type.
- Common duplicate-node patterns.
- Which humans are responsive for certain question types.
- Tool latency, error rates, and reliability.
- Prompt, model, schema, and policy versions used during prior runs.

Agent memory should not store:

- Unscoped private company facts as reusable truth.
- Sensitive source content unless explicitly allowed by policy.
- Evidence-free claims about the company.
- Data from one organization that can influence another organization.

### 9.2 Agent Memory Record

```ts
type AgentMemoryRecord = {
  id: string;
  agentId: string;
  organizationId: string;
  memoryKind:
    | "run_outcome"
    | "human_feedback"
    | "heuristic"
    | "failure_pattern"
    | "confidence_calibration"
    | "tool_performance"
    | "routing_preference"
    | "schema_lesson";
  summary: string;
  sourceRunIds: string[];
  relatedPolicyIds: string[];
  scope:
    | "agent_only"
    | "agent_type_within_org"
    | "organization_agents"
    | "global_anonymized";
  sensitivity: "low" | "medium" | "high";
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 9.3 Agent Run Log

Every important agent action should produce a run log. Agent memories are distilled from these logs.

```ts
type AgentRun = {
  id: string;
  agentId: string;
  organizationId: string;
  taskType: string;
  inputRefs: string[];
  outputPatchIds: string[];
  questionIds: string[];
  toolsUsed: string[];
  modelVersion?: string;
  promptVersion?: string;
  policyVersion: string;
  status: "succeeded" | "failed" | "partial" | "blocked";
  errorSummary?: string;
  evaluatorFeedback?: string;
  startedAt: string;
  finishedAt: string;
};
```

### 9.4 Learning Loop

```text
Agent performs task
-> AgentRun is recorded
-> Validator/human accepts, edits, or rejects output
-> Feedback is attached to the run
-> Memory distiller creates private agent memory
-> Future runs use relevant private memories as behavioral hints
```

Example:

```text
Node allocation agent repeatedly merges "Billing API" and "Billing Service" incorrectly.
Human rejects the merge twice.
Agent memory stores: in this organization, those labels usually refer to separate nodes.
Future node allocation proposals become more conservative.
```

### 9.5 Isolation Rules

Agent private memory must obey strict isolation rules:

- It is not part of the company knowledge graph.
- It cannot be cited as evidence for company assertions.
- It should be scoped to one organization by default.
- Cross-organization learning must be anonymized and stripped of source content.
- Sensitive memories should expire or require explicit retention.
- Users should be able to inspect and delete agent memories for their organization.

### 9.6 Agent Memory Uses

Agent private memory improves:

- Retrieval planning.
- Confidence scoring.
- Question routing.
- Duplicate detection.
- Connector reliability.
- Chunking and extraction choices.
- Schema proposal quality.
- Patch acceptance rate.
- Reduction of repeated mistakes.

## 10. Permission and Privacy Model

This system will handle sensitive company data. Permissions must be part of the core architecture.

### 10.1 Permission Propagation

Every source record, evidence object, node, assertion, and generated summary should carry access constraints.

```text
If a user cannot access the evidence,
the system should not reveal knowledge derived only from that evidence.
```

### 10.2 Derived Knowledge Policy

Derived knowledge is dangerous because it can leak private information indirectly.

Example:

```text
Private executive email says Project X is being cancelled.
The system must not answer broadly: "Project X is cancelled."
```

Policy options:

- Strict: derived assertions inherit the most restrictive evidence permissions.
- Blended: broad answers require at least one broadly accessible evidence item.
- Redacted: answer that private evidence exists but do not reveal details.

MVP should use strict inheritance.

### 10.3 Sensitive Data Controls

The system should detect and tag:

- Secrets and API keys.
- Personal information.
- Financial data.
- Legal data.
- HR data.
- Security incidents.
- Customer confidential information.

Sensitive assertions should require stricter review and narrower visibility.

## 11. Data Storage Plan

### 11.1 MVP Storage

Use the simplest stack that still proves the architecture:

```text
PostgreSQL
Nodes, assertions, evidence metadata, patches, audit events, permissions.

pgvector
Embeddings for chunks, evidence, node summaries, and questions.

Local/object storage
Raw source snapshots and extracted text.

Background job queue
Connector sync, ingestion jobs, agent jobs, projection jobs.

Agent private memory tables
Agent runs, feedback, calibration records, and private operational memories.

Markdown or simple web views
Human-readable projections.
```

### 11.2 Later Storage

Add specialized infrastructure when needed:

```text
Neo4j
For deeper graph traversal and graph analytics.

OpenSearch
For stronger full-text search.

S3-compatible object storage
For production raw artifact storage.

Kafka / event stream
For high-volume connector and agent events.

Warehouse connector
For analytics over graph evolution.
```

## 12. Agentic Retrieval Design

Retrieval is also an agentic process. The system should not simply run vector search and generate an answer from similar chunks. It should plan the query, select tools, retrieve graph state, expand evidence, check permissions, account for uncertainty, and produce an auditable answer.

Core retrieval principle:

```text
RAG retrieves text chunks.
This system retrieves evidence-backed graph state.
```

### 12.1 Retrieval Flow

```text
User or agent asks a question
-> Query planner classifies intent
-> Permission scope is computed
-> Retrieval agent chooses strategies
-> Graph/vector/lexical/structured/audit lookups run
-> Candidate nodes and assertions are merged
-> Evidence and source snippets are expanded
-> Results are ranked by trust, freshness, confidence, and relevance
-> Answer verifier checks support and uncertainty
-> Response includes answer, evidence, confidence, and open questions
```

### 12.2 Query Planner

The query planner decides what kind of question is being asked and which retrieval paths are needed.

```ts
type RetrievalPlan = {
  query: string;
  userId: string;
  organizationId: string;
  intent:
    | "fact_lookup"
    | "why_question"
    | "decision_history"
    | "owner_lookup"
    | "status_summary"
    | "contradiction_check"
    | "open_questions"
    | "timeline"
    | "structured_data_query"
    | "similar_context_search";
  strategies: Array<
    | "graph"
    | "vector"
    | "lexical"
    | "structured"
    | "audit_history"
  >;
  permissionScope: string[];
  requiredEvidence: boolean;
  includeUncertainty: boolean;
  freshnessRequirement?: "current" | "historical" | "any";
};
```

Example strategy choices:

```text
"Who owns billing?"
-> graph first, evidence second

"Why did we choose ledger?"
-> decision graph + evidence + audit history

"What changed last week?"
-> audit history + temporal graph traversal

"Find discussions similar to this bug"
-> vector search + graph expansion

"Which claims are disputed?"
-> graph query over contradiction assertions

"Show current billing metrics"
-> structured data binding + graph context
```

### 12.3 Hybrid Retrieval

The retrieval agent should combine multiple retrieval modes.

Graph retrieval:

- Finds known nodes and assertions.
- Traverses relationships.
- Follows ownership, decision, dependency, contradiction, and supersession edges.

Vector retrieval:

- Finds semantically similar chunks, evidence, node summaries, and prior questions.
- Handles fuzzy language, synonyms, and incomplete user wording.

Lexical retrieval:

- Finds exact terms, names, IDs, PR numbers, acronyms, customer names, and code symbols.

Structured retrieval:

- Queries RDBMS or API bindings for metrics, records, status, and tabular data.

Audit retrieval:

- Reconstructs what changed, when, by whom, and why.
- Supports temporal questions and historical belief state.

### 12.4 Knowledge Package

Retrieval should return a structured package, not a loose list of chunks.

```ts
type KnowledgePackage = {
  query: string;
  plan: RetrievalPlan;
  nodes: Node[];
  assertions: Assertion[];
  evidence: Evidence[];
  sourceSnippets: SourceSnippet[];
  auditEvents: AuditEvent[];
  confidenceSummary: {
    level: "low" | "medium" | "high";
    reasons: string[];
  };
  permissionSummary: {
    appliedPolicyIds: string[];
    redactions: string[];
  };
  uncertainty: {
    openQuestions: QuestionNode[];
    disputedAssertions: Assertion[];
    staleAssertions: Assertion[];
    inferredAssertions: Assertion[];
  };
};
```

### 12.5 Ranking Policy

The answer should prefer stronger knowledge over weaker matches.

Ranking order:

```text
Accepted assertions with strong evidence
> human-confirmed answers
> authoritative docs
> recent source excerpts
> inferred claims
> weak semantic matches
```

Ranking signals:

- Relevance to query.
- Source trust.
- Evidence count and independence.
- Human confirmation.
- Freshness.
- Permission compatibility.
- Assertion status.
- Contradiction status.
- Agent confidence.

### 12.6 Retrieval-Time Ask-Back

Retrieval may reveal that the system cannot answer safely. In that case, it should create a question instead of inventing an answer.

Examples:

```text
User asks: "Why was the launch delayed?"
System finds: roadmap changed, ticket dates moved, Slack debate, but no final reason.
Action: answer with uncertainty and create a `clarify_rationale` question.
```

```text
User asks: "Who owns the billing API?"
System finds: three possible owners from different sources.
Action: return candidates with evidence and create a `confirm_owner` question.
```

Retrieval can therefore be both an answer path and a memory-improvement path.

### 12.7 Answer Contract

Every generated answer should include:

- Direct answer when supported.
- Evidence references.
- Confidence level.
- Freshness or last-confirmed time.
- Whether the answer is observed, inferred, disputed, or unknown.
- Open questions or missing context when relevant.

The answer generator should refuse to present unsupported inferred claims as facts.

## 13. Core Product Interfaces

### 13.1 Admin Connector Console

Purpose:

- Add connectors.
- Configure sync scope.
- Configure permissions.
- Monitor sync status.
- Pause/revoke sources.

### 13.2 Knowledge Search

Purpose:

- Search across company memory.
- Use the agentic retrieval layer to combine semantic, lexical, graph, structured, audit-history, and permission-aware retrieval.
- Always show evidence.
- Show confidence, freshness, and uncertainty state.
- Create follow-up questions when important context is missing.

### 13.3 Ask-Back Inbox

Purpose:

- Show questions that need human confirmation.
- Let users confirm, edit, reject, or delegate.
- Keep answers lightweight.

### 13.4 Decision Log

Purpose:

- Show accepted decisions.
- Show rationale, evidence, owner, superseded decisions, and open gaps.

### 13.5 Project Memory Page

Purpose:

- Summarize a project from accepted graph state.
- Include owners, goals, status, decisions, open questions, risks, and recent changes.

### 13.6 Agent Context API

Purpose:

- Allow other AI agents to retrieve trustworthy context.
- Return structured knowledge packages with evidence, confidence, freshness, uncertainty, and permission-aware summaries.

## 14. MVP Workflow

### 14.1 First MVP Scenario

Start with:

- Slack connector.
- File upload.
- GitHub connector.
- Manual answer flow.

This gives enough signal to test the full loop:

```text
Conversation -> document/code change -> inferred decision gap -> human confirmation -> accepted memory
```

### 14.2 MVP End-to-End Flow

```text
Admin connects Slack channel and GitHub repo
-> System backfills selected history
-> Agents create source, message, thread, PR, person, project nodes
-> Agents extract candidate claims and decisions
-> System detects uncertain decision
-> Question appears in ask-back inbox
-> Human confirms final decision and rationale
-> System creates accepted Decision node
-> Project memory page updates
-> Search can now answer with evidence and audit trail
```

### 14.3 MVP Success Demo

The demo should answer:

```text
What did we decide about billing migration?
Who owns the current implementation?
Which Slack thread and PR led to this?
What is still uncertain?
What changed since last week?
```

## 15. Implementation Phases

### Phase 1: Local Knowledge Core

Build:

- PostgreSQL schema.
- Node/assertion/evidence/patch/audit tables.
- Agent run and private memory tables.
- File upload ingestion.
- Basic embeddings.
- Manual patch approval.
- Simple search and evidence viewer.
- Basic retrieval planner that can choose graph, vector, lexical, and evidence lookups.

Exit criteria:

- A file can be uploaded.
- Candidate nodes and assertions are proposed.
- Unsupported claims are rejected.
- Accepted claims can explain their evidence.
- Retrieval returns a structured knowledge package, not only raw chunks.
- Agent runs are logged and can store private correction memories.

### Phase 2: Slack + Ask-Back Loop

Build:

- Slack connector.
- Thread/message normalization.
- Person and channel nodes.
- Decision gap detection.
- Ask-back inbox.
- Human answer to graph patch flow.
- Retrieval-time question creation when important context is missing.
- Human feedback can update the relevant agent's private memory.

Exit criteria:

- A Slack thread can produce a question.
- A human answer can create or update a Decision node.
- The decision is visible with evidence and audit history.
- A query with ambiguous evidence can generate a routed ask-back question.
- Repeated rejected proposals make the agent more conservative in future runs.

### Phase 3: GitHub + Project Memory

Build:

- GitHub connector.
- PR/issue/code reference nodes.
- Link PRs to decisions and projects.
- Project memory page.
- "What changed?" report.
- Audit-history retrieval for timeline and change questions.

Exit criteria:

- A PR can be linked to a decision or decision gap.
- A project page shows owners, decisions, open questions, and recent changes.
- Retrieval can answer "what changed?" from audit events and graph state.

### Phase 4: Database and External API Connectors

Build:

- Read-only database connector.
- External API connector framework.
- Schema discovery for tables/API responses.
- Storage bindings for structured data.

Exit criteria:

- A database table can be represented as a node with storage bindings.
- Agents can create claims from structured records with evidence pointers.

### Phase 5: Governance and Scale

Build:

- Advanced permissions.
- Sensitive data detection.
- Contradiction agent.
- Freshness agent.
- Admin audit reports.
- Connector monitoring.

Exit criteria:

- The system can safely operate across multiple teams with restricted data.
- Sensitive knowledge does not leak through derived summaries.

## 16. Key Technical Decisions

### 16.1 PostgreSQL-First

Start with PostgreSQL and pgvector. This reduces operational complexity and is enough to prove the knowledge model.

Add Neo4j later only if graph traversal becomes a bottleneck or product workflows need advanced graph analytics.

### 16.2 Patch-Based Mutation

Agents should submit patches. Validators apply accepted patches.

This keeps the graph auditable and prevents agents from silently corrupting accepted state.

### 16.3 Strict Permission Inheritance

For MVP, derived assertions inherit the most restrictive permission among their evidence.

This avoids accidental leakage from private channels, emails, and restricted documents.

### 16.4 Human Questions Are First-Class

Questions are not notifications. They are graph nodes with evidence, routing, lifecycle, and audit history.

This lets the system model missing knowledge explicitly.

### 16.5 Retrieval Is Agentic

Retrieval should be implemented as a planner-driven agent workflow, not a single query against a vector store.

The retrieval agent should produce structured knowledge packages and should be able to create follow-up questions when retrieval exposes missing or disputed context.

### 16.6 Agent Memory Is Separate

Agent private memory should improve agent performance without becoming organizational truth.

It should be scoped, inspectable, deletable, and unable to serve as evidence for accepted company assertions.

## 17. Risks and Mitigations

### 17.1 Too Many Questions

Risk:

The system annoys users by asking about every small uncertainty.

Mitigation:

- Prioritize by impact.
- Batch low-priority questions.
- Route only to likely owners.
- Use confidence and blast-radius thresholds.

### 17.2 False Confidence

Risk:

The graph presents inferred claims as facts.

Mitigation:

- Separate observed, inferred, disputed, and unknown states.
- Display confidence and evidence.
- Require human confirmation for important decisions.

### 17.3 Permission Leakage

Risk:

Private source data leaks through summaries or derived claims.

Mitigation:

- Strict permission inheritance.
- Sensitivity tagging.
- Evidence-aware answer generation.
- Audit logs for every answer.

### 17.4 Connector Complexity

Risk:

Every external system has different APIs, permissions, and rate limits.

Mitigation:

- Build a common connector contract.
- Start with a small connector set.
- Treat connector health as a product surface.

### 17.5 Stale Knowledge

Risk:

Old decisions and owners remain visible as current.

Mitigation:

- Freshness metadata.
- Revalidation jobs.
- Supersession assertions.
- "Last confirmed" display.

### 17.6 Retrieval Hallucination

Risk:

The answer generator uses retrieved snippets to produce a confident answer that is not supported by accepted assertions or evidence.

Mitigation:

- Require answers to cite evidence-backed assertions.
- Run answer verification against the knowledge package.
- Label inferred answers clearly.
- Prefer "unknown" plus ask-back over unsupported certainty.

### 17.7 Agent Memory Leakage

Risk:

An agent private memory accidentally stores sensitive company facts or leaks patterns across organizations.

Mitigation:

- Scope memories to one organization by default.
- Strip raw source content from distilled memories.
- Use sensitivity tags and retention policies.
- Let admins inspect and delete agent memories.
- Prohibit agent memories from serving as evidence in the company graph.

## 18. Open Questions

- Should the first target user be engineering teams, founder teams, or research teams?
- Should Slack ingestion include DMs, or only public/private channels explicitly selected by admins?
- Should users answer questions in Slack, email, or inside the app first?
- What is the minimum useful ontology for company decisions?
- How should the system choose the best human to ask?
- What should happen when a human answer conflicts with source evidence?
- Should accepted decisions require one approver or multiple approvers?
- How should source deletion affect derived accepted knowledge?
- How much autonomy should retrieval agents have to create ask-back questions?
- Should retrieval plans be visible to users for debugging trust?
- What should the default retention period be for agent private memories?
- Which agent memories can be shared across agents inside the same organization?
- Should admins be able to disable agent learning per connector or source type?

## 19. First Build Recommendation

Build the MVP around engineering/product team memory:

```text
Slack + GitHub + file uploads + human ask-back
```

This domain has enough observable signal to prove the concept:

- Slack contains messy decision discussion.
- GitHub contains actual implementation.
- Files contain official docs.
- Humans can confirm the missing rationale.

The first strong user experience should be:

```text
"Show me what we know about this project, what changed recently,
what decisions were made, and what the system is still unsure about."
```
