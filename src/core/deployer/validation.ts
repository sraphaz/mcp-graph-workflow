/**
 * Deployer validation schemas — Zod boundary validation for MCP tool inputs.
 */

import { z } from "zod/v4";

export const DeployOptionsSchema = z.object({
  hasSnapshots: z.boolean().optional(),
  knowledgeCount: z.number().int().min(0).optional(),
});

export type ValidatedDeployOptions = z.infer<typeof DeployOptionsSchema>;

export function validateDeployOptions(input: unknown): ValidatedDeployOptions {
  return DeployOptionsSchema.parse(input);
}
