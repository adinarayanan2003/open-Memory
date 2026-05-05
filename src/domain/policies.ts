import type { GraphPatch, MemoryScope, PatchStatus, ValidationResult } from "./types.js";

export const policyVersion = "memory-policy-v1";

export function validatePatch(patch: GraphPatch): { status: PatchStatus; results: ValidationResult[] } {
  const results: ValidationResult[] = [];
  const hasEvidence = patch.evidenceIds.length > 0;
  const highConfidence = patch.confidence >= 0.78;
  const lowSensitivity = patch.sensitivity === "low";
  const safeScope = patch.suggestedScope !== "private_do_not_use" && patch.suggestedScope !== "forgotten";

  results.push({
    rule: "evidence_required",
    passed: hasEvidence,
    message: hasEvidence ? "Patch includes evidence." : "Patch has no evidence."
  });
  results.push({
    rule: "auto_accept_confidence",
    passed: highConfidence,
    message: highConfidence ? "Confidence is high enough for low-risk auto-accept." : "Confidence needs review."
  });
  results.push({
    rule: "sensitivity_gate",
    passed: lowSensitivity,
    message: lowSensitivity ? "Sensitivity is low." : "Sensitive memory needs review."
  });
  results.push({
    rule: "scope_gate",
    passed: safeScope,
    message: safeScope ? "Suggested scope can be used." : "Suggested scope is restricted."
  });

  const status = hasEvidence && highConfidence && lowSensitivity && safeScope ? "accepted" : "needs_review";
  return { status, results };
}

export function retrievalScopes(scopes?: MemoryScope[]): MemoryScope[] {
  return scopes?.length
    ? scopes
    : ["available_to_assistant", "search_only", "only_when_explicitly_asked", "time_limited"];
}

export function canRetrieve(scope: MemoryScope, allowed: MemoryScope[]): boolean {
  return scope !== "forgotten" && scope !== "private_do_not_use" && allowed.includes(scope);
}

