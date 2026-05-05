# open-Memory

`open-Memory` is a backend-first prototype for **agent-maintained personal long-term memory**.

The core idea is not "save text and search it later." The system ingests personal sources, extracts candidate memories, stores them as typed graph state with evidence, and keeps them maintained through agents. Memories can be accepted, reviewed, forgotten, made private, or queried with provenance.

## Current State

This repo currently implements a local TypeScript backend with:

- Fastify HTTP API for source ingestion, jobs, patches, questions, retrieval, and forgetting.
- Agent pipeline for ingestion, extraction, graph patching, validation, maintenance, retrieval, and private agent memory.
- Patch-based memory mutation with audit events.
- Prisma-backed PostgreSQL persistence by default.
- Durable Redis/BullMQ job runtime with a separate worker process.
- Scheduled maintenance jobs for freshness, contradiction, and evidence integrity.
- In-memory store for isolated unit tests and explicit `MEMORY_STORE=memory` development.
- Prisma migration for the persistent schema.

## System Shape

```mermaid
flowchart TD
  User[User or assistant] --> API[HTTP API]
  API --> Queue[Redis/BullMQ queue]
  Worker[Worker process] --> Queue
  Worker --> Engine[MemoryEngine]
  Engine --> Ingestion[IngestionAgent]
  Ingestion --> Extraction[ExtractionAgent]
  Extraction --> Graph[GraphAgent]
  Graph --> Validation[Validation policy]
  Validation -->|low-risk| Apply[Apply graph patch]
  Validation -->|uncertain or sensitive| Question[Question / ask-back]
  Apply --> Store[(MemoryStore)]
  Question --> Store
  Store --> Prisma[(PostgreSQL via Prisma)]
  Store --> Retrieval[RetrievalAgent]
  Retrieval --> Package[Evidence-backed memory package]
```

## Memory Model

The runtime works through a `MemoryStore` interface. Agents do not directly mutate durable memory. They propose graph patches, validators decide whether a patch can be accepted, and applied patches emit audit events.

```mermaid
flowchart LR
  SourceRecord[SourceRecord] --> Chunk[Chunk]
  Chunk --> Evidence[Evidence]
  Evidence --> Patch[GraphPatch]
  Patch --> Node[Node]
  Patch --> Assertion[Assertion]
  Assertion --> Evidence
  Patch --> AuditEvent[AuditEvent]
  Patch --> Question[Question when review is needed]
  AgentRun[AgentRun] --> AgentMemory[Private agent memory]
```

Important separation:

- **Personal memory** stores what the user may want remembered.
- **Agent private memory** stores operational lessons for agents.
- Agent private memory cannot be cited as evidence for personal facts.

## Agent Pipeline

```mermaid
sequenceDiagram
  participant API
  participant Queue
  participant Worker
  participant Engine
  participant IngestionAgent
  participant ExtractionAgent
  participant GraphAgent
  participant Validator
  participant Store

  API->>Engine: create source
  Engine->>Store: SourceConnection + SourceRecord
  API->>Queue: enqueue durable job in Redis
  Worker->>Queue: claim job
  Worker->>Engine: process extraction job
  Engine->>IngestionAgent: chunk source + create evidence
  IngestionAgent->>Store: chunks + evidence
  Engine->>ExtractionAgent: extract candidates
  ExtractionAgent-->>Engine: projects, preferences, decisions, open loops
  Engine->>GraphAgent: propose graph patches
  GraphAgent->>Store: pending GraphPatch
  GraphAgent->>Validator: validate patch
  Validator-->>GraphAgent: accepted or needs_review
  GraphAgent->>Store: apply patch or create question
```

## Backend Interfaces

Implemented API areas:

```text
POST /sources/manual
POST /sources/files
POST /sources/notes/import

POST /ingestion/jobs
GET  /jobs/:id
GET  /jobs?status=waiting|active|completed|failed|delayed&limit=50

GET  /nodes
GET  /assertions
GET  /patches
POST /patches/:id/accept
POST /patches/:id/reject

GET  /questions
POST /questions/:id/answer

POST /memory/query
POST /memory/forget

GET  /agents/runs
GET  /agents/memory
```

## Local Setup

Install dependencies:

```bash
npm install --cache /tmp/open-memory-npm-cache
```

Create environment config:

```bash
cp .env.example .env
```

Start Postgres and Redis, then run migrations:

```bash
docker compose up -d postgres redis
npm run db:migrate
```

Start the API:

```bash
npm run dev
```

Start the worker in a second terminal:

```bash
npm run worker
```

The default runtime uses Prisma/PostgreSQL and Redis/BullMQ. For a temporary non-persistent runtime:

```bash
MEMORY_STORE=memory JOB_QUEUE=memory npm run dev
```

## API Smoke Test

Health check:

```bash
curl http://127.0.0.1:3000/health
```

Add a manual memory:

```bash
curl -X POST http://127.0.0.1:3000/sources/manual \
  -H 'content-type: application/json' \
  -d '{"userId":"user","title":"Current work","text":"I am working on open-Memory and building a backend memory engine."}'
```

Query memory:

```bash
curl -X POST http://127.0.0.1:3000/memory/query \
  -H 'content-type: application/json' \
  -d '{"userId":"user","query":"open-Memory","includeEvidence":true}'
```

List pending review items:

```bash
curl http://127.0.0.1:3000/patches?status=needs_review
curl http://127.0.0.1:3000/questions?status=open
```

Inspect jobs:

```bash
curl http://127.0.0.1:3000/jobs?status=completed
curl http://127.0.0.1:3000/jobs?status=failed
```

## Development Commands

```bash
npm run typecheck
npm test
npm run build
npm audit
```

Database-backed and queue-backed tests require local services from `.env`:

```bash
docker compose up -d postgres redis
npm run db:migrate
npm run test:db
npm run test:queue
```

Prisma commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:reset
```

## Repository Layout

```text
src/agents/          agent services for ingestion, extraction, graph updates, maintenance, retrieval
src/domain/          shared memory types and policies
src/engine/          MemoryEngine orchestration
src/http/            Fastify routes and request schemas
src/queue/           in-process test queue, BullMQ queue, worker, scheduler, dispatcher
src/repositories/    MemoryStore interface, in-memory store, Prisma store
prisma/              schema and migrations
tests/               unit and DB integration tests
```

## Design Principles

- Memory changes go through patches.
- Accepted memory must have evidence.
- Sensitive or uncertain memories become questions.
- Forgetting must remove memory from retrieval.
- Agent private memory improves agents, but is not personal truth.
- Retrieval returns evidence-backed memory packages, not loose chunks.

## Roadmap

Near-term backend work:

- Add real embedding generation and pgvector similarity search.
- Add stronger extraction providers behind a deterministic adapter.
- Add source connectors beyond manual/files/notes.
- Add migration-safe seed and fixture workflows for DB tests.
- Expand maintenance agents beyond initial freshness, contradiction, and evidence integrity sweeps.

## Documents

- [Agentic Knowledge Graph Spec](AGENTIC_KNOWLEDGE_GRAPH_SPEC.md)
- [System Design Plan: Personal Long-Term Memory](SYSTEM_DESIGN_PLAN.md)
