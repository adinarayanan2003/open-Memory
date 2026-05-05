import { z } from "zod";

export const userIdSchema = z.string().min(1).default("user");

export const createTextSourceSchema = z.object({
  userId: userIdSchema,
  title: z.string().min(1),
  text: z.string().min(1),
  suggestedScope: z
    .enum([
      "available_to_assistant",
      "search_only",
      "only_when_explicitly_asked",
      "private_do_not_use",
      "time_limited",
      "forgotten"
    ])
    .optional()
});

export const createJobSchema = z.object({
  type: z.enum(["extract_source", "freshness_sweep", "contradiction_sweep", "evidence_integrity"]),
  payload: z.record(z.unknown()).default({})
});

export const memoryQuerySchema = z.object({
  userId: userIdSchema,
  query: z.string().min(1),
  allowedScopes: z
    .array(
      z.enum([
        "available_to_assistant",
        "search_only",
        "only_when_explicitly_asked",
        "private_do_not_use",
        "time_limited",
        "forgotten"
      ])
    )
    .optional(),
  includeEvidence: z.boolean().optional(),
  includeOpenQuestions: z.boolean().optional()
});

export const answerQuestionSchema = z.object({
  answer: z.string().min(1)
});

export const forgetMemorySchema = z.object({
  targetId: z.string().min(1)
});

