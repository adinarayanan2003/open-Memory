# Agentic Knowledge Graph Spec

## 1. Summary

This project is a living, agent-maintained knowledge system where the primary artifact is not a document, table, vector index, or simple graph. The primary artifact is a typed, justified, versioned, and auditable semantic graph.

The system stores knowledge as nodes, assertions, evidence, storage bindings, and immutable audit events. Always-running agents ingest sources, propose nodes and relationships, detect contradictions, update stale knowledge, and maintain graph quality over time.

The system can use RDBMS tables, vector databases, object storage, raw text files, graph databases, search indexes, and external APIs as backing stores. The graph does not replace these systems. It coordinates them.

Core idea:

```text
The graph stores meaning.
Backing stores store bulk data.
Assertions connect meaning to evidence.
Events make every change auditable.
Agents propose changes.
Validators accept or reject them.
```

## 2. Motivation

Current AI memory and knowledge systems usually fall into one of these patterns:

- RAG retrieves chunks from documents but does not maintain durable knowledge.
- Vector memory remembers semantically similar text but has weak structure and weak auditability.
- LLM-maintained wikis compile sources into readable pages but make relationships implicit.
- Graph databases store relationships but do not govern whether claims are true, justified, current, or trusted.

This system combines the useful parts:

- Graph databases for explicit relationships.
- Vector databases for semantic retrieval.
- RDBMS/object stores for structured and raw data.
- LLM Wiki-style compilation for human-readable projections.
- Agentic maintenance loops for continuous updates.
- Versioned evidence and audit trails for trust.

The target is not just "memory for an AI agent." The target is governed knowledge infrastructure for systems that must know why they believe something.

## 3. Design Principles

### 3.1 Typed

All nodes and relationships must have declared types. The schema defines allowed node types, assertion predicates, required fields, validation rules, and evidence requirements.

Example node types:

- `Concept`
- `Entity`
- `Claim`
- `Document`
- `Dataset`
- `Experiment`
- `Decision`
- `Question`
- `Task`
- `CodeModule`
- `Person`
- `Organization`
- `Source`

Example predicates:

- `supports`
- `contradicts`
- `derives_from`
- `depends_on`
- `supersedes`
- `caused_by`
- `mentions`
- `defines`
- `implements`
- `owned_by`
- `measured_by`
- `validated_by`

### 3.2 Justified

Assertions must point to evidence. Evidence can be a document chunk, database row, log event, human note, external URL, code commit, metric, API response, or another accepted assertion.

The system should distinguish:

- A raw observation.
- A claim extracted from a source.
- A derived inference.
- A human-approved fact.
- A deprecated or contradicted claim.

### 3.3 Versioned

Knowledge changes over time. The system must preserve historical versions of nodes, assertions, schemas, and evidence links.

The current graph is a materialized view derived from immutable events.

### 3.4 Auditable

Every mutation must answer:

- What changed?
- Who or what proposed it?
- Who or what accepted it?
- What evidence justified it?
- What previous state did it replace?
- What validation rules were applied?
- When did it happen?

### 3.5 Agent-Maintained, Not Agent-Trusted

Agents should mostly propose graph patches. Validators, policies, confidence thresholds, and optional human review decide what becomes accepted knowledge.

Agents can be powerful, but they should not silently rewrite truth.

## 4. Relationship to Existing Systems

### 4.1 Neo4j

Neo4j is a graph database. It can store nodes and relationships and answer graph queries.

This project may use Neo4j as a storage backend, but the project is larger than Neo4j. Neo4j does not by itself provide evidence governance, assertion lifecycle, schema-aware agents, contradiction resolution, or immutable audit logs.

### 4.2 Supermemory

Supermemory is closer to an AI memory/context layer. It is useful for giving AI products memory over users, documents, conversations, and projects.

This project is more explicit about low-level governance: typed assertions, versioned graph patches, evidence objects, storage routing, and auditability.

### 4.3 LLM Wiki

LLM Wiki compiles raw sources into a maintained Markdown wiki. It is human-readable and easy to inspect.

This project can produce an LLM Wiki as a projection, but the graph is the source of truth. Markdown pages are views over accepted graph state, not the primary knowledge model.

## 5. Core Data Model

### 5.1 Node

A node represents a semantic object. It is the stable identity for a concept, entity, source, claim, dataset, decision, or other knowledge object.

```ts
type Node = {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  attributes: Record<string, unknown>;
  storageBindings: StorageBinding[];
  currentVersion: string;
  status: "active" | "merged" | "deprecated" | "rejected";
  createdAt: string;
  updatedAt: string;
};
```

Important rule:

```text
The node is not the payload.
The node is the semantic identity that points to one or more payload stores.
```

### 5.2 Assertion

An assertion is a typed, evidence-backed relationship or claim. It is stronger than a simple edge because it carries provenance, confidence, lifecycle, and versioning.

```ts
type Assertion = {
  id: string;
  subjectNodeId: string;
  predicate: PredicateType;
  objectNodeId?: string;
  literalValue?: unknown;
  qualifiers: Record<string, unknown>;
  evidenceIds: string[];
  confidence: number;
  status: "proposed" | "accepted" | "rejected" | "superseded" | "contradicted";
  createdBy: ActorId;
  acceptedBy?: ActorId;
  validFrom?: string;
  validUntil?: string;
  supersedes: string[];
  currentVersion: string;
  createdAt: string;
  updatedAt: string;
};
```

Examples:

```text
Paper A -> introduces -> Concept B
Experiment X -> supports -> Claim Y
Trial Z -> contradicts -> Claim Y
Service A -> depends_on -> Service B
Decision D -> supersedes -> Decision C
```

### 5.3 Evidence

Evidence is a pointer to the source material that justifies an assertion.

```ts
type Evidence = {
  id: string;
  type:
    | "document_chunk"
    | "database_row"
    | "file"
    | "url"
    | "api_response"
    | "human_note"
    | "metric"
    | "code_reference"
    | "accepted_assertion";
  sourceId: string;
  locator: string;
  quote?: string;
  hash?: string;
  capturedAt: string;
  trustLevel: "unknown" | "low" | "medium" | "high" | "authoritative";
  metadata: Record<string, unknown>;
};
```

Evidence must be immutable where possible. If the original source changes, the system should capture a new evidence object rather than silently editing the old one.

### 5.4 Storage Binding

Storage bindings connect semantic nodes to physical storage systems.

```ts
type StorageBinding = {
  id: string;
  nodeId: string;
  kind:
    | "raw_text"
    | "object_store"
    | "vector_index"
    | "rdbms_table"
    | "rdbms_row"
    | "graph_subgraph"
    | "search_index"
    | "git_reference"
    | "external_api";
  uri: string;
  schemaRef?: string;
  accessPolicyRef?: string;
  createdAt: string;
};
```

Examples:

```text
Document node    -> raw text in object storage + chunks in vector DB
Dataset node     -> Postgres table or Parquet files
Experiment node  -> RDBMS metrics + artifact files + notes
Code module node -> Git refs + AST index + embeddings
Claim node       -> assertion objects + evidence pointers
Concept node     -> graph assertions + summary projection + embeddings
```

### 5.5 Graph Patch

Agents do not directly mutate accepted graph state. They submit patches.

```ts
type GraphPatch = {
  id: string;
  proposedBy: ActorId;
  reason: string;
  operations: PatchOperation[];
  evidenceIds: string[];
  confidence: number;
  validationResults: ValidationResult[];
  status: "pending" | "accepted" | "rejected" | "needs_review";
  createdAt: string;
  resolvedAt?: string;
};
```

Patch operations:

- Create node.
- Update node attributes.
- Add storage binding.
- Create assertion.
- Supersede assertion.
- Merge nodes.
- Split node.
- Deprecate node.
- Attach evidence.
- Update schema.

### 5.6 Audit Event

Audit events form the immutable history of the system.

```ts
type AuditEvent = {
  id: string;
  eventType: string;
  actorId: ActorId;
  patchId?: string;
  targetIds: string[];
  beforeHash?: string;
  afterHash?: string;
  reason?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};
```

The accepted graph is a materialized view over audit events and accepted patches.

## 6. Storage Architecture

The system should use specialized stores instead of forcing all data into one database.

### 6.1 Graph Store

Stores:

- Node identities.
- Accepted assertions.
- Current graph topology.
- Queryable relationships.

Possible implementations:

- Neo4j.
- ArangoDB.
- PostgreSQL with graph-style tables.
- RDF/triplestore if ontology requirements become strict.

### 6.2 Event Store

Stores:

- Graph patches.
- Audit events.
- Version history.
- Schema migration events.

Possible implementations:

- PostgreSQL append-only tables.
- EventStoreDB.
- Kafka plus durable sink.

### 6.3 Object Store

Stores:

- Raw documents.
- Uploaded files.
- Snapshots.
- Artifacts.
- Source archives.

Possible implementations:

- S3-compatible object storage.
- Local filesystem for MVP.

### 6.4 Vector Store

Stores:

- Chunk embeddings.
- Node summary embeddings.
- Evidence embeddings.
- Query embeddings.

Possible implementations:

- Qdrant.
- Weaviate.
- pgvector.
- Pinecone.

### 6.5 RDBMS

Stores:

- Structured datasets.
- Measurements.
- Metrics.
- Tabular records.
- Operational metadata.

Possible implementations:

- PostgreSQL.
- DuckDB for local analytical MVP.

### 6.6 Search Index

Stores:

- Lexical indexes over source text.
- Node labels and aliases.
- Evidence text.
- Summaries.

Possible implementations:

- OpenSearch.
- Elasticsearch.
- Tantivy.
- PostgreSQL full-text search for MVP.

## 7. Agents

### 7.1 Ingestion Agent

Responsibilities:

- Watch new sources.
- Normalize source metadata.
- Extract raw chunks.
- Create source and document nodes.
- Create evidence candidates.

Outputs:

- Candidate nodes.
- Evidence records.
- Storage bindings.
- Ingestion audit events.

### 7.2 Node Allocation Agent

Responsibilities:

- Decide whether extracted information belongs to an existing node or a new node.
- Propose aliases.
- Detect duplicates.
- Assign node types.

Outputs:

- Create-node patches.
- Merge-node patches.
- Alias assertions.

### 7.3 Edge/Assertion Proposal Agent

Responsibilities:

- Extract relationships from evidence.
- Propose typed assertions.
- Attach evidence.
- Estimate confidence.

Outputs:

- Assertion patches.

### 7.4 Evidence Agent

Responsibilities:

- Verify that assertions have adequate evidence.
- Check source quality.
- Ensure evidence locators are valid.
- Re-capture volatile sources.

Outputs:

- Evidence quality scores.
- Evidence repair patches.
- Review requests.

### 7.5 Contradiction Agent

Responsibilities:

- Detect assertions that cannot both be true.
- Detect outdated claims.
- Detect source conflicts.
- Group competing claims.

Outputs:

- Contradiction assertions.
- Review tasks.
- Supersession suggestions.

### 7.6 Freshness Agent

Responsibilities:

- Track time-sensitive nodes and assertions.
- Revalidate old claims.
- Decay confidence where appropriate.
- Request re-ingestion from sources.

Outputs:

- Staleness markers.
- Revalidation patches.
- Refresh jobs.

### 7.7 Schema Steward Agent

Responsibilities:

- Detect when existing node or edge types are insufficient.
- Propose schema additions.
- Flag schema drift.
- Enforce required fields and evidence rules.

Outputs:

- Schema patches.
- Validation reports.

### 7.8 Summarization/Projection Agent

Responsibilities:

- Produce readable summaries from accepted graph state.
- Generate LLM Wiki-style pages.
- Generate entity profiles.
- Generate decision histories.
- Generate contradiction reports.

Outputs:

- Markdown pages.
- UI summaries.
- Export bundles.

### 7.9 Audit Agent

Responsibilities:

- Verify patches obey governance rules.
- Check that accepted assertions have evidence.
- Check that high-risk changes had appropriate review.
- Detect suspicious agent behavior.

Outputs:

- Audit reports.
- Blocked patches.
- Human review tasks.

## 8. Validation and Governance

### 8.1 Patch Lifecycle

```text
proposed -> validated -> accepted
                   \-> rejected
                   \-> needs_review
```

Validation should check:

- Schema compliance.
- Required evidence.
- Confidence threshold.
- Source trust level.
- Duplicate risk.
- Contradiction risk.
- Permissions.
- Blast radius.

### 8.2 Confidence Model

Confidence should not be a single magic number. It should be derived from multiple signals:

- Source trust.
- Extraction confidence.
- Number of independent evidence items.
- Recency.
- Human approval.
- Agreement with existing graph state.
- Agent reliability history.

### 8.3 Human Review

Human review should be required for:

- Schema changes.
- High-impact claims.
- Node merges with many dependents.
- Legal, medical, financial, or security-sensitive assertions.
- Contradictions between authoritative sources.
- Low-confidence but high-importance patches.

## 9. Query Model

The system should support several query styles.

### 9.1 Graph Query

Example:

```text
Which claims about Drug A contradict accepted trial results?
```

Requires:

- Graph traversal.
- Predicate filtering.
- Evidence retrieval.
- Status filtering.

### 9.2 Semantic Query

Example:

```text
Find concepts similar to this research hypothesis.
```

Requires:

- Vector search.
- Node/evidence embeddings.
- Graph expansion.

### 9.3 Evidence Query

Example:

```text
Why does the system believe Service A depends on Service B?
```

Requires:

- Assertion lookup.
- Evidence resolution.
- Audit history.
- Source display.

### 9.4 Temporal Query

Example:

```text
What did we believe about this architecture decision before the incident?
```

Requires:

- Event replay.
- Versioned materialized views.
- Time-bounded assertions.

### 9.5 Maintenance Query

Example:

```text
Which accepted claims are stale, weakly evidenced, or contradicted?
```

Requires:

- Validation state.
- Freshness metadata.
- Contradiction graph.
- Confidence scores.

## 10. System Workflows

### 10.1 Source Ingestion

```text
New source arrives
-> Ingestion agent chunks and stores raw content
-> Source/document nodes are proposed
-> Evidence objects are created
-> Node allocation agent maps extracted entities/concepts
-> Assertion agent proposes relationships
-> Validators check schema/evidence/conflicts
-> Accepted patches update materialized graph
-> Projection agent updates summaries/wiki pages
```

### 10.2 Claim Update

```text
New evidence conflicts with old assertion
-> Contradiction agent creates conflict patch
-> Freshness agent marks old assertion stale
-> Validators compare source quality
-> Human review if needed
-> Old assertion is superseded or marked contradicted
-> Audit event records the change
```

### 10.3 Node Merge

```text
Two nodes appear to represent the same concept/entity
-> Node allocation agent proposes merge
-> System computes affected assertions and bindings
-> Validator checks risk
-> Human review if high blast radius
-> Merge patch accepted
-> Old node redirects to canonical node
-> Audit event preserves history
```

### 10.4 Human Question Answering

```text
User asks a question
-> Query planner chooses graph/vector/search/RDBMS tools
-> Relevant nodes and assertions are retrieved
-> Evidence is resolved
-> Answer is generated with citations to evidence
-> Optional: unanswered gaps become Question nodes
```

## 11. MVP Scope

The MVP should prove the core loop without overbuilding.

### 11.1 MVP Goals

- Create typed nodes.
- Create evidence-backed assertions.
- Store raw source text.
- Store embeddings for semantic retrieval.
- Submit graph patches from agents.
- Accept/reject patches through validators.
- Maintain immutable audit events.
- Query "why does the system believe this?"
- Generate a readable Markdown projection.

### 11.2 MVP Node Types

- `Source`
- `Document`
- `Chunk`
- `Concept`
- `Entity`
- `Claim`
- `Question`

### 11.3 MVP Predicates

- `mentions`
- `defines`
- `supports`
- `contradicts`
- `derives_from`
- `supersedes`
- `similar_to`

### 11.4 MVP Storage

Recommended simple stack:

```text
PostgreSQL       -> nodes, assertions, patches, audit events
pgvector         -> embeddings
local filesystem -> raw source files
Markdown folder  -> LLM Wiki-style projection
```

Neo4j can be added later if graph traversal needs outgrow PostgreSQL.

### 11.5 MVP Agents

- Ingestion agent.
- Node allocation agent.
- Assertion proposal agent.
- Validator.
- Projection agent.

The contradiction, freshness, schema steward, and audit agents can be added after the first useful loop works.

## 12. Non-Goals

The first version should not try to:

- Replace all databases.
- Build a universal ontology.
- Fully automate truth.
- Support every data type.
- Handle high-stakes domains without human review.
- Optimize for massive scale before correctness is proven.
- Use autonomous agents to mutate accepted state without validation.

## 13. Risks

### 13.1 Hallucination Graph

If agents create weak assertions without evidence, the graph becomes a structured hallucination.

Mitigation:

- Evidence required for accepted assertions.
- Confidence thresholds.
- Audit agent.
- Human review for high-risk changes.

### 13.2 Schema Explosion

Agents may invent too many node and predicate types.

Mitigation:

- Schema steward agent.
- Human approval for schema changes.
- Conservative starter ontology.

### 13.3 Duplicate Nodes

The system may create many nodes for the same concept.

Mitigation:

- Alias handling.
- Entity resolution.
- Merge workflow.
- Canonical node policy.

### 13.4 Trust Confusion

Users may treat all accepted assertions as equally reliable.

Mitigation:

- Display confidence, evidence, source quality, and review state.
- Separate accepted, human-approved, inferred, stale, and contradicted claims.

### 13.5 Storage Complexity

Supporting many backing stores can make the system hard to operate.

Mitigation:

- MVP starts with PostgreSQL, pgvector, local files, and Markdown projections.
- Add additional stores only when a node type requires them.

## 14. Open Questions

- Should claims be modeled as nodes, assertions, or both?
- What is the minimum useful schema for the first domain?
- Which domain should be used for the MVP: personal memory, codebase knowledge, research papers, or company docs?
- What confidence thresholds should require human review?
- Should the graph store be PostgreSQL-first or Neo4j-first?
- How should agents be evaluated over time?
- How should deleted or private sources affect accepted assertions?
- What UI is needed first: graph explorer, patch review queue, evidence viewer, or question-answering interface?

## 15. Suggested First Build

Build a local-first prototype for one domain, such as research notes or codebase documentation.

Phase 1:

- Define schema for `Source`, `Document`, `Chunk`, `Concept`, `Claim`, and `Question`.
- Store raw documents locally.
- Store nodes/assertions/audit events in PostgreSQL.
- Store embeddings with pgvector.
- Implement patch submission and validation.

Phase 2:

- Add ingestion from Markdown/PDF/text.
- Extract candidate concepts and claims.
- Attach evidence to assertions.
- Build a patch review CLI or small web UI.

Phase 3:

- Generate LLM Wiki-style Markdown pages from accepted graph state.
- Add "why do we believe this?" queries.
- Add contradiction detection.

Phase 4:

- Add storage bindings for structured datasets.
- Add freshness tracking.
- Add graph visualization.
- Add multi-agent maintenance loop.

## 16. Success Criteria

The system is working when it can:

- Ingest a new source.
- Create typed candidate nodes.
- Propose evidence-backed assertions.
- Reject unsupported claims.
- Accept valid graph patches.
- Explain why an assertion exists.
- Show how a claim changed over time.
- Detect at least simple contradictions.
- Generate a readable knowledge projection.
- Route different node payloads to appropriate storage backends.

