# AGENTS.md

This repo is a backend-first prototype for agent-maintained personal long-term memory. Work here should preserve the core system idea: typed, evidence-backed, versioned, auditable memory maintained by durable agents, with ask-back when the system is uncertain.

## Source Of Truth

Before making architectural or behavioral changes, read:

- `README.md` for the current implemented runtime.
- `SYSTEM_DESIGN_PLAN.md` for the intended product and architecture.
- `AGENTIC_KNOWLEDGE_GRAPH_SPEC.md` for the conceptual memory graph model.
- `package.json` for available commands.

The implementation should stay aligned with `SYSTEM_DESIGN_PLAN.md`. If a change intentionally deviates from the plan, update the relevant design document in the same change and explain why the deviation is better or necessary.

## Product Direction

Prioritize the backend and agent runtime over frontend work.

The important layers are:

- Durable ingestion and maintenance agents.
- Typed personal memory graph.
- Evidence-backed assertions.
- Patch-based graph mutation.
- Ask-back questions for uncertainty, sensitivity, stale claims, and missing context.
- Agentic retrieval with provenance.
- Agent private memory that improves agents over time but is not treated as personal truth.

Do not turn this into a simple notes app, vector search wrapper, or generic RAG demo.

## Architecture Rules

- Agents should not directly mutate durable memory. They should propose graph patches, and patches should be validated, accepted, rejected, or routed to questions.
- Accepted memories must be connected to evidence.
- Weak, sensitive, contradictory, or stale signals should become questions or review items rather than silent durable facts.
- Forgetting must remove memory from retrieval and preserve an audit trail where appropriate.
- Retrieval should return evidence-backed memory packages, not loose chunks.
- Agent private memory must remain separate from the user's personal memory graph and must not be cited as evidence for user facts.
- Durable runtime work should assume the API and worker can run as separate processes.
- Prefer extending `MemoryStore`, `MemoryEngine`, agents, queues, and Prisma schema consistently instead of bypassing existing boundaries.

## Implementation Workflow

1. Start by checking the current repo state with `git status --short`.
2. Read the nearby code before editing. Follow existing patterns unless there is a concrete reason to change them.
3. Keep changes focused on the requested capability.
4. For schema changes, update Prisma schema, migrations, repository interfaces, in-memory store, Prisma store, and tests together.
5. For agent or queue changes, update tests for both the in-process test path and the durable runtime path when practical.
6. For new API behavior, update routes, schemas, README endpoint docs, and smoke-test examples if relevant.
7. Do not revert user changes or unrelated dirty files.

## Documentation Requirements

Update docs in the same change when behavior, architecture, commands, endpoints, or setup change.

At minimum:

- Update `README.md` when the implemented runtime changes.
- Update `SYSTEM_DESIGN_PLAN.md` when the intended architecture changes.
- Update `AGENTIC_KNOWLEDGE_GRAPH_SPEC.md` when graph concepts, node types, edge semantics, evidence rules, or versioning/audit rules change.
- If implementation diverges from the plan for a pragmatic reason, document the deviation and rationale instead of leaving drift.

The README should describe what exists now. The system design plan should describe where the system is going.

## Verification

Run the narrowest useful checks for the change. Common commands:

```bash
npm run typecheck
npm test
npm run build
npm audit
```

Service-backed checks require local infrastructure:

```bash
docker compose up -d postgres redis
npm run db:migrate
npm run test:db
npm run test:queue
```

If Docker, Postgres, or Redis is unavailable, say which checks could not run and why. Do not claim service-backed verification passed unless it actually ran.

## Local Runtime

Default runtime:

- API: `npm run dev`
- Worker: `npm run worker`
- Store: Prisma/PostgreSQL
- Queue: Redis/BullMQ

Temporary in-memory runtime:

```bash
MEMORY_STORE=memory JOB_QUEUE=memory npm run dev
```

Use the in-memory path for isolated tests. Do not design production behavior around it.

## Commit Hygiene

- Keep commits scoped and descriptive.
- Include docs and tests with the code that requires them.
- Do not commit generated noise unless it is required by the repo.
- Before finalizing, check `git status --short` and summarize remaining uncommitted work, if any.

