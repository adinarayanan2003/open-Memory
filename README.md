# open-Memory

Backend-first implementation and design docs for an agentic personal long-term memory system.

The project explores a personal memory layer: connectors ingest notes, files, calendar, browser/bookmarks, chats, and other personal sources; agents construct a typed and evidence-backed knowledge graph; retrieval is handled through agentic planning; and uncertain memories are routed back to the user through ask-back workflows.

## Backend MVP

The current implementation is a local TypeScript backend with:

- HTTP API for source ingestion, jobs, patches, questions, retrieval, and forgetting.
- Agent pipeline for ingestion, extraction, node allocation, assertion proposal, validation, maintenance, retrieval, and private agent memory.
- Patch-based memory mutation with audit events.
- PostgreSQL + pgvector Prisma schema and Docker Compose storage contract.
- In-memory runtime store for fast local development and tests.

## Run

```bash
npm install --cache /tmp/open-memory-npm-cache
npm run dev
```

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

Run checks:

```bash
npm run typecheck
npm test
npm run build
```

## Documents

- [Agentic Knowledge Graph Spec](AGENTIC_KNOWLEDGE_GRAPH_SPEC.md)
- [System Design Plan: Personal Long-Term Memory](SYSTEM_DESIGN_PLAN.md)
