import type { Chunk, ExtractionCandidate, ExtractionOutput, ProposedQuestion } from "../domain/types.js";

export class ExtractionAgent {
  async extract(chunks: Chunk[]): Promise<ExtractionOutput> {
    const candidates: ExtractionCandidate[] = [];
    const proposedQuestions: ProposedQuestion[] = [];

    for (const chunk of chunks) {
      const text = chunk.text;
      const lower = text.toLowerCase();

      if (/\b(open-memory|project|building|working on|prototype|mvp)\b/i.test(text)) {
        candidates.push({
          kind: "project",
          label: extractLabel(text, ["open-Memory", "memory engine", "personal memory"]) ?? "Personal memory project",
          summary: summarize(text),
          evidenceChunkIds: [chunk.id],
          confidence: lower.includes("working on") || lower.includes("building") ? 0.84 : 0.72,
          sensitivity: "low",
          suggestedScope: "available_to_assistant"
        });
      }

      if (/\b(i prefer|i like|i want|please always|concise|detailed|style)\b/i.test(text)) {
        const sensitivity = /\bhealth|finance|private|secret|password|legal\b/i.test(text) ? "high" : "low";
        candidates.push({
          kind: "preference",
          label: extractPreferenceLabel(text),
          summary: summarize(text),
          evidenceChunkIds: [chunk.id],
          confidence: lower.includes("i prefer") || lower.includes("please always") ? 0.88 : 0.66,
          sensitivity,
          suggestedScope: sensitivity === "high" ? "only_when_explicitly_asked" : "available_to_assistant"
        });
      }

      if (/\b(decided|decision|chose|not pursue|drop|dropped)\b/i.test(text)) {
        candidates.push({
          kind: "decision",
          label: extractLabel(text, ["decision", "not pursue", "drop"]) ?? "Personal decision",
          summary: summarize(text),
          evidenceChunkIds: [chunk.id],
          confidence: lower.includes("decided") ? 0.82 : 0.7,
          sensitivity: "low",
          suggestedScope: "search_only"
        });
      }

      if (/\b(todo|need to|promised|follow up|send|by friday|commitment)\b/i.test(text)) {
        candidates.push({
          kind: "open_loop",
          label: extractLabel(text, ["todo", "follow up", "send"]) ?? "Open commitment",
          summary: summarize(text),
          evidenceChunkIds: [chunk.id],
          confidence: lower.includes("promised") || lower.includes("need to") ? 0.8 : 0.64,
          sensitivity: "low",
          suggestedScope: "available_to_assistant"
        });
        proposedQuestions.push({
          kind: "confirm_commitment",
          prompt: `Should I track this as an open commitment: "${summarize(text)}"?`,
          evidenceChunkIds: [chunk.id],
          priority: "medium"
        });
      }

      if (/\b(health|finance|password|secret|private|legal)\b/i.test(text)) {
        proposedQuestions.push({
          kind: "classify_sensitivity",
          prompt: `This looks sensitive. Should this memory be private, search-only, or available when explicitly asked?`,
          evidenceChunkIds: [chunk.id],
          priority: "high"
        });
      }
    }

    return { candidates: dedupeCandidates(candidates), proposedQuestions };
  }
}

function summarize(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function extractPreferenceLabel(text: string): string {
  if (/concise/i.test(text)) return "Prefers concise answers";
  if (/detailed/i.test(text)) return "Prefers detailed explanations";
  return "Personal preference";
}

function extractLabel(text: string, hints: string[]): string | undefined {
  const sentence = text
    .split(/[.!?\n]/)
    .map((part) => part.trim())
    .find((part) => hints.some((hint) => part.toLowerCase().includes(hint.toLowerCase())));
  return sentence ? sentence.slice(0, 80) : undefined;
}

function dedupeCandidates(candidates: ExtractionCandidate[]): ExtractionCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.kind}:${candidate.label.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

