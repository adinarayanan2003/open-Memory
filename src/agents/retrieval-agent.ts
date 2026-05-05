import { retrievalScopes } from "../domain/policies.js";
import type { MemoryScope, PersonalMemoryPackage } from "../domain/types.js";
import type { MemoryStore } from "../repositories/memory-store.js";

export class RetrievalAgent {
  constructor(private readonly store: MemoryStore) {}

  async query(input: {
    userId: string;
    query: string;
    allowedScopes?: MemoryScope[];
    includeEvidence?: boolean;
    includeOpenQuestions?: boolean;
  }): Promise<PersonalMemoryPackage> {
    const allowedScopes = retrievalScopes(input.allowedScopes);
    const search = await this.store.searchText(input.query, allowedScopes);
    const assertions = search.assertions;
    const nodeIds = new Set(assertions.flatMap((assertion) => [assertion.subjectNodeId, assertion.objectNodeId]));
    const expandedNodes = await Promise.all(
      [...nodeIds].filter(Boolean).map((id) => this.store.getNode(id as string))
    );
    const nodes = dedupeById([...search.nodes, ...expandedNodes.filter((node) => node !== undefined)]);
    const evidenceIds = [...new Set(assertions.flatMap((assertion) => assertion.evidenceIds))];
    const evidence = input.includeEvidence === false ? [] : await this.store.listEvidence(evidenceIds);
    const sourceSnippets = [];
    for (const item of evidence) {
      const chunk = item.type === "chunk" ? await this.store.getChunk(item.sourceId) : undefined;
      sourceSnippets.push({
        evidenceId: item.id,
        text: item.quote ?? chunk?.text ?? "",
        sourceRecordId: String(item.metadata.sourceRecordId ?? "")
      });
    }
    const openQuestions = input.includeOpenQuestions === false ? [] : await this.store.listQuestions("open");
    const confidence = assertions.some((assertion) => assertion.confidence >= 0.85)
      ? "high"
      : assertions.length || nodes.length
        ? "medium"
        : "low";

    return {
      query: input.query,
      answer: buildAnswer(input.query, nodes.map((node) => node.label)),
      nodes,
      assertions,
      evidence,
      sourceSnippets,
      confidence,
      memoryStates: [...new Set([...nodes.map((node) => node.memoryState), ...assertions.map((a) => a.memoryState)])],
      openQuestions
    };
  }
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function buildAnswer(query: string, labels: string[]): string | undefined {
  if (!labels.length) return undefined;
  return `For "${query}", I found: ${labels.slice(0, 5).join(", ")}.`;
}

