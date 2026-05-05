import { newId, nowIso } from "../lib/id.js";
import type { Assertion, Predicate } from "../domain/types.js";
import type { MemoryStore } from "../repositories/memory-store.js";

export class MaintenanceAgent {
  constructor(private readonly store: MemoryStore) {}

  async runFreshnessSweep(): Promise<void> {
    const assertions = await this.store.listAssertions();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    for (const assertion of assertions) {
      if (
        assertion.status === "accepted" &&
        assertion.memoryState !== "forgotten" &&
        Date.now() - Date.parse(assertion.updatedAt) > ninetyDaysMs
      ) {
        await this.store.updateAssertion({ ...assertion, memoryState: "stale", updatedAt: nowIso() });
        await this.store.createQuestion({
          id: newId("question"),
          questionKind: "confirm_memory",
          prompt: `Is this still true? ${String(assertion.qualifiers.summary ?? assertion.predicate)}`,
          relatedNodeIds: [assertion.subjectNodeId, assertion.objectNodeId].filter(Boolean) as string[],
          evidenceIds: assertion.evidenceIds,
          priority: "low",
          status: "open",
          createdBy: "freshness-agent-v1",
          createdAt: nowIso()
        });
      }
    }
  }

  async runContradictionSweep(): Promise<void> {
    const assertions = (await this.store.listAssertions()).filter((assertion) => assertion.status === "accepted");
    const byPredicate = groupBy(assertions, (assertion) => assertion.predicate);
    for (const predicate of ["prefers", "decided"] satisfies Predicate[]) {
      const group = byPredicate.get(predicate) ?? [];
      const objectIds = new Set(group.map((assertion) => assertion.objectNodeId).filter(Boolean));
      if (objectIds.size > 1) {
        await this.store.createQuestion({
          id: newId("question"),
          questionKind: predicate === "prefers" ? "confirm_preference" : "clarify_rationale",
          prompt: `I found multiple ${predicate} memories. Which one should be current?`,
          relatedNodeIds: [...objectIds] as string[],
          evidenceIds: [...new Set(group.flatMap((assertion) => assertion.evidenceIds))],
          priority: "medium",
          status: "open",
          createdBy: "contradiction-agent-v1",
          createdAt: nowIso()
        });
      }
    }
  }

  async runEvidenceIntegrity(): Promise<void> {
    const assertions = await this.store.listAssertions();
    for (const assertion of assertions) {
      const evidence = await this.store.listEvidence(assertion.evidenceIds);
      if (assertion.status === "accepted" && evidence.length === 0) {
        await this.store.updateAssertion({ ...assertion, status: "contradicted", updatedAt: nowIso() });
      }
    }
  }
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

