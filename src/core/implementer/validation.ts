/**
 * Implementer validation schemas — Zod boundary validation for MCP tool inputs.
 */

import { z } from "zod/v4";

export const ImplementerInputSchema = z.object({
  nodeId: z.string().min(1),
  action: z.enum(["start", "progress", "done"]).optional(),
  agentId: z.string().optional(),
});

export type ValidatedImplementerInput = z.infer<typeof ImplementerInputSchema>;

export function validateImplementerInput(input: unknown): ValidatedImplementerInput {
  return ImplementerInputSchema.parse(input);
}
