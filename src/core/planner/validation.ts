/**
 * Planner validation schemas — Zod boundary validation for MCP tool inputs.
 */

import { z } from "zod/v4";

export const NextTaskInputSchema = z.object({
  lockedTaskIds: z.array(z.string()).optional(),
  agentId: z.string().optional(),
});

export const SprintPlanInputSchema = z.object({
  sprintName: z.string().min(1),
  maxTasks: z.number().int().min(1).max(100).optional(),
  targetVelocity: z.number().min(0).optional(),
});

export type ValidatedNextTaskInput = z.infer<typeof NextTaskInputSchema>;
export type ValidatedSprintPlanInput = z.infer<typeof SprintPlanInputSchema>;

export function validateNextTaskInput(input: unknown): ValidatedNextTaskInput {
  return NextTaskInputSchema.parse(input);
}

export function validateSprintPlanInput(input: unknown): ValidatedSprintPlanInput {
  return SprintPlanInputSchema.parse(input);
}
