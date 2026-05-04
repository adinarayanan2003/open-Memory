# System Design Plan: Personal Long-Term Memory

## 1. Product Goal

Build a long-term personal memory system where a user can connect notes, files, email, calendar, browser/bookmarks, chats, tasks, photos, code, databases, and external APIs. Always-running agents ingest these sources, construct a typed and evidence-backed personal knowledge graph, and ask the user for clarification when the system detects uncertain memories, changed preferences, unresolved commitments, or missing context.

The system should not pretend to know the user perfectly. It should maintain what is remembered, what is inferred, what is sensitive, what is stale, and what needs confirmation.

Core product promise:

```text
A personal memory layer that remembers what matters,
shows why it remembers it,
asks before turning uncertainty into memory,
and lets the user edit or forget anything.
```

## 2. Core Design Principle

The system must separate six memory states:

```text
Observed
The system has direct evidence from a source.

Inferred
The system sees a likely pattern but lacks direct confirmation.

Confirmed
The user explicitly accepted or corrected the memory.

Sensitive
The memory can be used only under stricter rules.

Stale
The memory may no longer be true and needs revalidation.

Forgotten
The memory has been removed from active use by user request or policy.
```

This is the central trust model. Agents should turn uncertainty into questions instead of silently converting weak signals into durable personal facts.

## 3. High-Level Architecture

```text
User
    |
    v
Source Setup UI
    |
    v
Personal Source Connectors
Notes, Files, Email, Calendar, Browser, Chats, Tasks, Photos, Code, DBs, APIs
    |
    v
Ingestion Pipeline
Normalize -> Sensitivity Tag -> Chunk -> Store Raw -> Embed
    |
    v
Memory Construction
Node Allocation -> Assertion Proposal -> Evidence Linking -> Validation
    |
    v
Uncertainty Detection
Memory Gaps -> Changed Preferences -> Open Loops -> Stale Claims
    |
    v
Personal Ask-Back Loop
Question Routing -> User Confirmation -> Graph Patch -> Audit Event
    |
    v
Personal Memory Graph
Typed Nodes + Evidence + Versions + Scopes + Forgetting + Audit Trail
    |
    v
Agentic Retrieval Layer
Query Planning -> Hybrid Retrieval -> Evidence Expansion -> Answer Verification
    |
    v
Interfaces
Search, Q&A, Timeline, Memory Inbox, Project Pages, Assistant Context API

Sidecar:
Agent Private Memory Store
Per-agent run history, feedback, heuristics, failures, and calibration data
```

## 4. User-Facing Source Connection Layer

Users need a simple way to connect or dump personal context.

### 4.1 Source Types

Initial connector categories:

- Manual memories: typed notes, pasted text, quick capture.
- Local files: PDFs, Markdown, text files, CSVs, images, exported docs.
- Cloud files: Google Drive, iCloud Drive, OneDrive, Dropbox.
- Notes: Apple Notes exports, Notion, Obsidian, Logseq, Roam, Evernote.
- Email: Gmail, Outlook, local mail exports.
- Calendar: Google Calendar, Apple Calendar, Outlook Calendar.
- Browser and bookmarks: history exports, bookmarks, reading lists.
- Chats: personal chat exports, AI chat exports, selected messaging threads.
- Tasks: Todoist, Things, Linear personal workspace, GitHub issues.
- Code and projects: GitHub repos, local project folders, commit history.
- Photos and media metadata: albums, locations, timestamps, captions.
- Structured data: SQLite, Postgres, CSVs, personal spreadsheets.
- External APIs: fitness, finance, travel, CRM-like personal tools, custom APIs.

### 4.2 Connector Setup UX

The setup flow should ask:

- What source do you want to connect?
- Which folders, labels, accounts, calendars, notebooks, or API paths should be included?
- Should this source be continuously synced or imported once?
- Can this source be used proactively by the assistant, only for search, or only when explicitly asked?
- Is this source sensitive?
- How long should raw data and derived memories be retained?
- Should the system ask before storing long-term memories from this source?

Each connector should produce a `SourceConnection` record:

```ts
type SourceConnection = {
  id: string;
  type:
    | "manual"
    | "file_upload"
    | "cloud_drive"
    | "notes"
    | "email"
    | "calendar"
    | "browser"
    | "chat_export"
    | "tasks"
    | "code"
    | "photos"
    | "database"
    | "external_api";
  displayName: string;
  ownerUserId: string;
  syncMode: "one_time" | "scheduled" | "webhook" | "continuous";
  memoryScopePolicyId: string;
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
-> Apply sensitivity and memory-scope tags
-> Store immutable raw snapshot when allowed
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
    | "note"
    | "email"
    | "calendar_event"
    | "chat_message"
    | "thread"
    | "document"
    | "task"
    | "bookmark"
    | "web_history"
    | "photo_metadata"
    | "code_reference"
    | "database_row"
    | "api_response"
    | "file";
  rawObjectRef?: string;
  textRef?: string;
  memoryScopeTags: string[];
  sensitivityTags: string[];
  metadata: Record<string, unknown>;
};
```

### 5.2 Connector Requirements

Every connector must support:

- Incremental sync.
- One-time import.
- Source revocation.
- Retention policy.
- Sensitivity tagging.
- Stable external IDs.
- Raw snapshot controls.
- Sync audit logs.
- Deletion and forgetting propagation.

## 6. Personal Memory Graph Model

The graph should follow the model from `AGENTIC_KNOWLEDGE_GRAPH_SPEC.md`, with personal-memory-specific node types.

### 6.1 Core Node Types

- `Person`
- `Relationship`
- `Place`
- `Project`
- `Goal`
- `Preference`
- `Habit`
- `Event`
- `Memory`
- `Decision`
- `OpenLoop`
- `Question`
- `Reminder`
- `Document`
- `Message`
- `Email`
- `CalendarEvent`
- `Task`
- `Bookmark`
- `Topic`
- `HealthRecord`
- `FinanceRecord`
- `TravelPlan`
- `CodeProject`
- `Source`

### 6.2 Core Predicates

- `mentions`
- `authored_by`
- `participated_in`
- `related_to`
- `prefers`
- `avoids`
- `likes`
- `dislikes`
- `owns`
- `working_on`
- `committed_to`
- `decided`
- `supersedes`
- `supports`
- `contradicts`
- `depends_on`
- `happened_at`
- `scheduled_for`
- `last_confirmed_by`
- `needs_confirmation_from`
- `should_remind_at`
- `has_evidence`

### 6.3 Personal Memory Assertion Example

```ts
type Assertion = {
  id: "assertion_123";
  subjectNodeId: "user";
  predicate: "working_on";
  objectNodeId: "project_open_memory";
  evidenceIds: [
    "evidence_note_456",
    "evidence_git_commit_789"
  ];
  confidence: 0.84;
  status: "confirmed";
  memoryState: "active";
  memoryScope: "available_to_assistant";
  createdBy: "agent_assertion_v1";
  acceptedBy: "user";
  validFrom: "2026-05-05T00:00:00Z";
  currentVersion: "v2";
  createdAt: "2026-05-05T10:30:00Z";
  updatedAt: "2026-05-05T10:30:00Z";
};
```

## 7. Personal Ask-Back Loop

The ask-back loop is a first-class system component. Personal memory quality depends on asking the user lightweight questions at the right time.

### 7.1 When the System Should Ask

Agents should create questions when they detect:

- A possible long-term preference.
- A changed preference or contradiction.
- A repeated topic that may be an active project.
- A commitment or promise that lacks a reminder.
- A decision without rationale.
- A goal that appears abandoned or stale.
- A person/relationship that needs disambiguation.
- A memory that may be sensitive.
- A source that should not be used proactively.
- A pattern that affects future assistant behavior.

### 7.2 Question Node

```ts
type QuestionNode = {
  id: string;
  type: "Question";
  questionKind:
    | "confirm_memory"
    | "confirm_preference"
    | "clarify_rationale"
    | "confirm_commitment"
    | "resolve_contradiction"
    | "classify_sensitivity"
    | "set_memory_scope"
    | "forget_or_archive"
    | "fill_missing_context";
  prompt: string;
  relatedNodeIds: string[];
  evidenceIds: string[];
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "answered" | "dismissed" | "expired";
  dueAt?: string;
  createdBy: string;
  createdAt: string;
};
```

### 7.3 Ask-Back Examples

Preference confirmation:

```text
You often ask for concise answers. Should I remember that as a general preference?
```

Commitment confirmation:

```text
This email sounds like you promised to send a draft by Friday. Should I track that?
```

Rationale clarification:

```text
You decided not to pursue the recruiting tool idea. What was the main reason?
```

Sensitivity classification:

```text
This note looks health-related. Should it be available to your assistant, search-only, or private?
```

Contradiction resolution:

```text
Earlier you preferred morning workouts, but recent notes say evenings work better.
Which should I remember as current?
```

### 7.4 Human Answer Handling

User answers should become graph patches, not loose comments.

```text
User answers question
-> System creates evidence from answer
-> Agent proposes graph patch
-> Validator checks schema, scope, and sensitivity
-> Accepted patch updates memory graph
-> Question node is marked answered
-> Audit event records what changed
```

## 8. Agent System

### 8.1 Connector Agents

Maintain syncs with personal sources.

Responsibilities:

- Fetch updates.
- Normalize records.
- Apply source scope and sensitivity policy.
- Detect connector errors.
- Emit ingestion jobs.

### 8.2 Ingestion Agents

Convert source records into chunks, evidence, and candidate memory nodes.

Responsibilities:

- Chunk text.
- Extract people, projects, goals, dates, tasks, and preferences.
- Create source/document/message/event/task nodes.
- Generate embeddings.
- Mark sensitive candidates conservatively.

### 8.3 Node Allocation Agents

Decide whether extracted objects should create new nodes or attach to existing ones.

Responsibilities:

- Entity resolution.
- Person and place disambiguation.
- Alias detection.
- Duplicate detection.
- Canonical node selection.

### 8.4 Assertion Agents

Create typed memory proposals.

Responsibilities:

- Propose assertions.
- Attach evidence.
- Estimate confidence.
- Mark weak memories as inferred, not confirmed.
- Avoid converting private source content into broad assistant context without policy approval.

### 8.5 Uncertainty Agents

Detect ambiguity and missing context.

Responsibilities:

- Create `Question` nodes.
- Create `OpenLoop` nodes.
- Detect possible preferences.
- Detect unresolved commitments.
- Escalate high-impact uncertainty.

### 8.6 Contradiction Agents

Detect conflicting memories.

Responsibilities:

- Compare preferences across time.
- Detect stale goals.
- Identify conflicting plans, commitments, and relationships.
- Ask the user to resolve meaningful contradictions.

### 8.7 Freshness Agents

Maintain time-sensitive memory.

Responsibilities:

- Revalidate old preferences.
- Mark stale projects and goals.
- Detect abandoned commitments.
- Reopen questions when new evidence changes memory state.

### 8.8 Forgetting Agents

Enforce user-controlled forgetting.

Responsibilities:

- Apply delete, archive, and private-mode requests.
- Remove or disable derived assertions when evidence is forgotten.
- Maintain tombstones when needed for audit without retaining sensitive content.
- Ensure forgotten memories are not used in retrieval or assistant context.

### 8.9 Projection Agents

Turn graph state into useful personal views.

Responsibilities:

- Generate project memory pages.
- Generate decision histories.
- Generate relationship briefs.
- Generate weekly reflection summaries.
- Generate "what changed in my life/projects?" reports.

### 8.10 Retrieval Agents

Retrieve evidence-backed memory state for the user and downstream assistants.

Responsibilities:

- Classify query intent.
- Choose retrieval strategies.
- Run graph, vector, lexical, structured, and audit-history lookups.
- Expand candidate results into evidence-backed memory packages.
- Apply memory-scope and sensitivity filters before and after retrieval.
- Rank confirmed, fresh, and well-evidenced memories above weak matches.
- Surface stale, inferred, sensitive, forgotten, and unknown states.
- Create new `Question` nodes when retrieval reveals missing context.

Retrieval agents should not behave like plain RAG. They should retrieve memory graph state, evidence, uncertainty, and audit history.

## 9. Agent Private Memory

Each agent should have its own private operational memory that improves the agent over time. This memory is separate from personal memory.

Important boundary:

```text
Personal memory stores what the user wants remembered.
Agent private memory stores how an agent learns to do its job better.
```

Agent private memory should not be used as direct evidence for personal facts. It can improve future behavior, routing, confidence calibration, and tool choice, but accepted personal memories must still come from source evidence, user answers, and audited graph patches.

### 9.1 What Agent Private Memory Stores

Agent memory can store:

- Past task outcomes.
- Successful and failed retrieval plans.
- Connector-specific sync issues.
- Extraction mistakes and corrections.
- User feedback on agent proposals.
- Confidence calibration history.
- Preferred chunking or parsing strategies for a source type.
- Common duplicate-node patterns.
- Which question formats the user answers.
- Tool latency, error rates, and reliability.
- Prompt, model, schema, and policy versions used during prior runs.

Agent memory should not store:

- Sensitive personal facts as reusable truth.
- Evidence-free claims about the user.
- Raw private source content unless explicitly allowed.
- Data from one user that can influence another user's memory.

### 9.2 Agent Memory Record

```ts
type AgentMemoryRecord = {
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
  scope:
    | "agent_only"
    | "agent_type_for_user"
    | "user_agents"
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
  userId: string;
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
-> Validator/user accepts, edits, or rejects output
-> Feedback is attached to the run
-> Memory distiller creates private agent memory
-> Future runs use relevant private memories as behavioral hints
```

Example:

```text
Node allocation agent repeatedly confuses "open-Memory" the repo with "personal memory" the concept.
User rejects the merge twice.
Agent memory stores: for this user, those should remain separate nodes.
Future node allocation proposals become more conservative.
```

### 9.5 Isolation Rules

Agent private memory must obey strict isolation rules:

- It is not part of the personal memory graph.
- It cannot be cited as evidence for personal memories.
- It should be scoped to one user by default.
- Cross-user learning must be anonymized and stripped of source content.
- Sensitive memories should expire or require explicit retention.
- Users should be able to inspect and delete agent memories.

## 10. Privacy, Scope, and Forgetting Model

Personal memory needs privacy and forgetting from day one.

### 10.1 Memory Scopes

Every source record, evidence object, node, assertion, and generated summary should carry a memory scope.

```text
If a memory is not allowed for proactive assistant use,
the system should not use it to personalize answers unless explicitly asked.
```

Suggested scopes:

- `available_to_assistant`
- `search_only`
- `only_when_explicitly_asked`
- `private_do_not_use`
- `time_limited`
- `forgotten`

### 10.2 Sensitive Data Policy

The system should detect and tag:

- Health data.
- Financial data.
- Legal data.
- Identity documents.
- Intimate relationships.
- Authentication secrets.
- Private communications.
- Location history.
- Personal photos and media.

Sensitive memories should default to narrow use and require explicit confirmation before proactive use.

### 10.3 Forgetting Policy

Forgetting must be user-controlled and technically enforced.

Forgetting options:

- Forget this memory.
- Forget this source.
- Archive but do not use proactively.
- Keep for search only.
- Delete raw evidence and derived memories.
- Expire after a date.

When evidence is deleted, derived assertions should be revalidated, downgraded, or forgotten depending on policy.

## 11. Data Storage Plan

### 11.1 MVP Storage

Use the simplest stack that still proves the architecture:

```text
PostgreSQL
Nodes, assertions, evidence metadata, patches, audit events, scopes, retention rules.

pgvector
Embeddings for chunks, evidence, node summaries, and questions.

Local/object storage
Raw source snapshots and extracted text, only when retention policy allows it.

Background job queue
Connector sync, ingestion jobs, agent jobs, projection jobs, forgetting jobs.

Agent private memory tables
Agent runs, feedback, calibration records, and private operational memories.

Markdown or simple web views
Human-readable personal memory projections.
```

### 11.2 Later Storage

Add specialized infrastructure when needed:

```text
Graph database
For deeper graph traversal and graph analytics.

Search index
For stronger full-text search.

Encrypted object storage
For production raw artifact storage.

Event stream
For high-volume connector and agent events.

Local-first encrypted store
For privacy-sensitive personal deployments.
```

## 12. Agentic Retrieval Design

Retrieval is also an agentic process. The system should not simply run vector search and generate an answer from similar chunks. It should plan the query, select tools, retrieve memory graph state, expand evidence, check scopes, account for uncertainty, and produce an auditable answer.

Core retrieval principle:

```text
RAG retrieves text chunks.
This system retrieves evidence-backed personal memory state.
```

### 12.1 Retrieval Flow

```text
User or assistant asks a question
-> Query planner classifies intent
-> Memory scope is computed
-> Retrieval agent chooses strategies
-> Graph/vector/lexical/structured/audit lookups run
-> Candidate nodes and assertions are merged
-> Evidence and source snippets are expanded
-> Results are ranked by confirmation, freshness, sensitivity, and relevance
-> Answer verifier checks support and uncertainty
-> Response includes answer, evidence, confidence, memory state, and open questions
```

### 12.2 Query Planner

```ts
type RetrievalPlan = {
  query: string;
  userId: string;
  intent:
    | "fact_lookup"
    | "why_question"
    | "decision_history"
    | "preference_lookup"
    | "relationship_lookup"
    | "project_summary"
    | "open_loops"
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
  allowedMemoryScopes: string[];
  requiredEvidence: boolean;
  includeUncertainty: boolean;
  freshnessRequirement?: "current" | "historical" | "any";
};
```

Example strategy choices:

```text
"What was I thinking about open-Memory last month?"
-> timeline + vector + project graph

"Why did I drop the recruiting tool idea?"
-> decision history + evidence + audit history

"What do I prefer for writing style?"
-> preference graph + user confirmations

"What did I promise Ravi?"
-> people graph + email/chat/task retrieval

"What projects am I neglecting?"
-> project graph + freshness + task/calendar signals
```

### 12.3 Knowledge Package

Retrieval should return a structured package, not a loose list of chunks.

```ts
type PersonalMemoryPackage = {
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
  scopeSummary: {
    appliedScopeIds: string[];
    redactions: string[];
  };
  uncertainty: {
    openQuestions: QuestionNode[];
    staleAssertions: Assertion[];
    inferredAssertions: Assertion[];
    sensitiveAssertions: Assertion[];
  };
};
```

### 12.4 Ranking Policy

The answer should prefer stronger memory over weaker matches.

Ranking order:

```text
User-confirmed memories
> accepted assertions with strong evidence
> recent source excerpts
> repeated observed patterns
> inferred memories
> weak semantic matches
```

Ranking signals:

- Relevance to query.
- User confirmation.
- Evidence count.
- Freshness.
- Memory scope.
- Sensitivity.
- Assertion status.
- Contradiction status.
- Agent confidence.

### 12.5 Retrieval-Time Ask-Back

Retrieval may reveal that the system cannot answer safely. In that case, it should create a question instead of inventing an answer.

Examples:

```text
User asks: "Why did I stop working on the newsletter?"
System finds: fewer commits, old notes, and a calendar conflict, but no explicit reason.
Action: answer with uncertainty and create a `clarify_rationale` question.
```

```text
User asks: "Do I like long-form explanations?"
System finds: old preference for concise answers and recent requests for detailed specs.
Action: return both with evidence and create a `confirm_preference` question.
```

Retrieval can therefore be both an answer path and a memory-improvement path.

### 12.6 Answer Contract

Every generated answer should include:

- Direct answer when supported.
- Evidence references.
- Confidence level.
- Freshness or last-confirmed time.
- Whether the memory is observed, inferred, confirmed, sensitive, stale, or unknown.
- Open questions or missing context when relevant.

The answer generator should refuse to present unsupported inferred memories as facts.

## 13. Core Product Interfaces

### 13.1 Source Console

Purpose:

- Add connectors.
- Configure sync scope.
- Configure memory scopes.
- Monitor sync status.
- Pause or revoke sources.

### 13.2 Memory Search

Purpose:

- Search across personal memory.
- Use the agentic retrieval layer to combine semantic, lexical, graph, structured, audit-history, and scope-aware retrieval.
- Always show evidence.
- Show confidence, freshness, and memory state.
- Create follow-up questions when important context is missing.

### 13.3 Memory Inbox

Purpose:

- Show questions that need user confirmation.
- Let the user confirm, edit, reject, archive, or forget.
- Keep answers lightweight.

### 13.4 Project Memory Page

Purpose:

- Summarize a project from accepted memory graph state.
- Include goals, decisions, open loops, notes, related files, people, risks, and recent changes.

### 13.5 Timeline

Purpose:

- Show memories, decisions, projects, and commitments over time.
- Support "what changed?" and "what was I thinking then?" questions.

### 13.6 Assistant Context API

Purpose:

- Allow an AI assistant to retrieve trustworthy context.
- Return structured memory packages with evidence, confidence, freshness, uncertainty, and memory scopes.

## 14. MVP Workflow

### 14.1 First MVP Scenario

Start with:

- Manual memory capture.
- File upload.
- Notes import.
- Calendar import.
- Simple browser/bookmark import.
- User answer flow.

This gives enough signal to test the full loop:

```text
Notes/files/calendar -> inferred memory gap -> user confirmation -> accepted memory
```

### 14.2 MVP End-to-End Flow

```text
User imports notes and files
-> System chunks and indexes selected sources
-> Agents create source, document, project, goal, preference, and question nodes
-> Agents extract candidate memories and decisions
-> System detects uncertain long-term memory
-> Question appears in memory inbox
-> User confirms or edits the memory
-> System creates accepted memory assertion
-> Project or preference page updates
-> Search can now answer with evidence and audit trail
```

### 14.3 MVP Success Demo

The demo should answer:

```text
What am I working on?
What did I decide about open-Memory?
What preferences should my assistant know?
What commitments are open?
What has gone stale?
Why does the system remember this?
What should it ask me before storing?
```

## 15. Implementation Phases

### Phase 1: Local Personal Memory Core

Build:

- PostgreSQL schema.
- Node/assertion/evidence/patch/audit/scope tables.
- Agent run and private memory tables.
- Manual memory capture.
- File upload ingestion.
- Basic embeddings.
- Manual patch approval.
- Basic retrieval planner.
- Simple search and evidence viewer.

Exit criteria:

- A file or manual memory can be added.
- Candidate nodes and assertions are proposed.
- Unsupported memories are rejected.
- Accepted memories can explain their evidence.
- Retrieval returns a structured memory package, not only raw chunks.
- Agent runs are logged and can store private correction memories.

### Phase 2: Notes + Calendar + Ask-Back Loop

Build:

- Notes import.
- Calendar import.
- Event, project, goal, and commitment extraction.
- Memory inbox.
- User answer to graph patch flow.
- Retrieval-time question creation when important context is missing.

Exit criteria:

- A note or calendar event can produce a question.
- A user answer can create or update a memory.
- The memory is visible with evidence and audit history.
- A query with ambiguous evidence can generate an ask-back question.
- Repeated rejected proposals make the agent more conservative in future runs.

### Phase 3: Browser + Email + Personal Project Memory

Build:

- Browser/bookmark import.
- Email import with conservative sensitivity defaults.
- Relationship and commitment nodes.
- Project memory page.
- "What changed?" report.
- Audit-history retrieval for timeline questions.

Exit criteria:

- A project page shows goals, decisions, open loops, files, people, and recent changes.
- Retrieval can answer "what changed?" from audit events and memory graph state.
- Sensitive email-derived memory is not used proactively without confirmation.

### Phase 4: External APIs and Structured Data

Build:

- Read-only database connector.
- External API connector framework.
- Schema discovery for tables/API responses.
- Storage bindings for structured data.
- Optional health/finance connectors with stricter scope controls.

Exit criteria:

- A structured source can be represented as a node with storage bindings.
- Agents can create memories from structured records with evidence pointers.
- Sensitive structured data defaults to restricted use.

### Phase 5: Privacy and Scale

Build:

- Stronger encryption.
- Advanced forgetting.
- Sensitive data detection.
- Contradiction agent.
- Freshness agent.
- Local-first mode investigation.
- Memory export/import.

Exit criteria:

- The user can inspect, correct, archive, and forget memories.
- Forgotten memory is excluded from retrieval and assistant context.
- Sensitive memory does not leak through derived summaries.

## 16. Key Technical Decisions

### 16.1 PostgreSQL-First

Start with PostgreSQL and pgvector. This reduces operational complexity and is enough to prove the memory model.

Add a graph database later only if graph traversal becomes a bottleneck or product workflows need advanced graph analytics.

### 16.2 Patch-Based Mutation

Agents should submit patches. Validators apply accepted patches.

This keeps memory auditable and prevents agents from silently corrupting accepted state.

### 16.3 User-Controlled Memory Scope

Every memory should have a use scope. The system should distinguish "remember for assistant behavior" from "keep for search only" and "private, do not use."

### 16.4 User Questions Are First-Class

Questions are not notifications. They are graph nodes with evidence, lifecycle, and audit history.

This lets the system model missing personal context explicitly.

### 16.5 Retrieval Is Agentic

Retrieval should be implemented as a planner-driven agent workflow, not a single query against a vector store.

The retrieval agent should produce structured memory packages and should be able to create follow-up questions when retrieval exposes missing or disputed context.

### 16.6 Agent Memory Is Separate

Agent private memory should improve agent performance without becoming personal truth.

It should be scoped, inspectable, deletable, and unable to serve as evidence for accepted personal memories.

## 17. Risks and Mitigations

### 17.1 Too Many Questions

Risk:

The system annoys the user by asking about every small uncertainty.

Mitigation:

- Prioritize by impact.
- Batch low-priority questions.
- Learn which question formats the user answers.
- Use confidence and memory-importance thresholds.

### 17.2 False Confidence

Risk:

The graph presents inferred memories as facts.

Mitigation:

- Separate observed, inferred, confirmed, sensitive, stale, and unknown states.
- Display confidence and evidence.
- Require user confirmation for important personal memories.

### 17.3 Privacy Leakage

Risk:

Private source data leaks through summaries, personalization, or derived memories.

Mitigation:

- Strict memory scopes.
- Sensitivity tagging.
- Evidence-aware answer generation.
- Audit logs for memory use.
- Conservative defaults for email, health, finance, and private chats.

### 17.4 Connector Complexity

Risk:

Every personal source has different APIs, export formats, permissions, and rate limits.

Mitigation:

- Build a common connector contract.
- Start with manual capture, files, notes, calendar, and bookmarks.
- Treat connector health as a product surface.

### 17.5 Stale Memory

Risk:

Old preferences, goals, and relationships remain visible as current.

Mitigation:

- Freshness metadata.
- Revalidation jobs.
- Supersession assertions.
- "Last confirmed" display.

### 17.6 Retrieval Hallucination

Risk:

The answer generator uses retrieved snippets to produce a confident answer that is not supported by accepted memories or evidence.

Mitigation:

- Require answers to cite evidence-backed assertions.
- Run answer verification against the memory package.
- Label inferred answers clearly.
- Prefer "unknown" plus ask-back over unsupported certainty.

### 17.7 Agent Memory Leakage

Risk:

An agent private memory accidentally stores sensitive personal facts or leaks patterns across users.

Mitigation:

- Scope memories to one user by default.
- Strip raw source content from distilled memories.
- Use sensitivity tags and retention policies.
- Let the user inspect and delete agent memories.
- Prohibit agent memories from serving as evidence in the personal graph.

## 18. Open Questions

- Should the first version be local-first or cloud-first?
- Which source should be the first real connector after manual/file import: notes, calendar, email, or browser?
- Should the assistant proactively ask questions daily, weekly, or only when queried?
- What is the minimum useful ontology for personal memory?
- Which memories should require explicit confirmation before storage?
- How should source deletion affect derived accepted memories?
- How much autonomy should retrieval agents have to create ask-back questions?
- Should retrieval plans be visible to the user for debugging trust?
- What should the default retention period be for agent private memories?
- Which personal memory types should default to `search_only`?

## 19. First Build Recommendation

Build the MVP around personal project and preference memory:

```text
Manual capture + file upload + notes import + calendar import + user ask-back
```

This domain has enough signal to prove the concept:

- Notes contain goals, ideas, decisions, and project context.
- Files contain durable artifacts.
- Calendar contains time and commitments.
- User confirmation resolves uncertainty.

The first strong user experience should be:

```text
"Show me what I am working on, what I decided,
what I promised, what has gone stale,
and what you need to ask me before remembering."
```

