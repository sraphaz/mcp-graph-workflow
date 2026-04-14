/**
 * Validator validation schemas — Zod boundary validation for MCP tool inputs.
 */

import { z } from "zod/v4";

export const ValidationInputSchema = z.object({
  action: z.enum(["ac", "dor", "dod", "integrity", "flow"]).optional(),
  nodeId: z.string().optional(),
  strict: z.boolean().optional(),
});

export type ValidatedValidationInput = z.infer<typeof ValidationInputSchema>;

export function validateValidationInput(input: unknown): ValidatedValidationInput {
  return ValidationInputSchema.parse(input);
}
