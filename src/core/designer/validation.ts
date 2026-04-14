/**
 * Designer validation schemas — Zod boundary validation for MCP tool inputs.
 */

import { z } from "zod/v4";

export const DesignInputSchema = z.object({
  scope: z.enum(["full", "incremental"]).optional(),
  includeTraceability: z.boolean().optional(),
  includeCoupling: z.boolean().optional(),
});

export type ValidatedDesignInput = z.infer<typeof DesignInputSchema>;

export function validateDesignInput(input: unknown): ValidatedDesignInput {
  return DesignInputSchema.parse(input);
}
