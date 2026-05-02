/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

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

/** validateNextTaskInput — auto-generated description placeholder. */
export function validateNextTaskInput(input: unknown): ValidatedNextTaskInput {
  return NextTaskInputSchema.parse(input);
}

/** validateSprintPlanInput — auto-generated description placeholder. */
export function validateSprintPlanInput(input: unknown): ValidatedSprintPlanInput {
  return SprintPlanInputSchema.parse(input);
}
