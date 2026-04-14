/**
 * Context validation schemas — Zod boundary validation for MCP tool inputs.
 */

import { z } from "zod/v4";

export const ContextQuerySchema = z.object({
  query: z.string().min(1),
  tokenBudget: z.number().int().min(100).max(100000).optional(),
  tier: z.enum(["summary", "standard", "deep"]).optional(),
  compress: z.boolean().optional(),
});

export const RagContextInputSchema = z.object({
  query: z.string().min(1),
  tokenBudget: z.number().int().min(100).optional(),
  phase: z.string().optional(),
});

export type ValidatedContextQuery = z.infer<typeof ContextQuerySchema>;
export type ValidatedRagContextInput = z.infer<typeof RagContextInputSchema>;

export function validateContextQuery(input: unknown): ValidatedContextQuery {
  return ContextQuerySchema.parse(input);
}

export function validateRagContextInput(input: unknown): ValidatedRagContextInput {
  return RagContextInputSchema.parse(input);
}
