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
 * Kanban validation schemas — Zod boundary validation for MCP tool inputs.
 */

import { z } from "zod/v4";

export const KanbanInputSchema = z.object({
  sprintId: z.string().optional(),
  columns: z.array(z.string()).optional(),
  groupBy: z.enum(["status", "priority", "type", "sprint"]).optional(),
});

export type ValidatedKanbanInput = z.infer<typeof KanbanInputSchema>;

export function validateKanbanInput(input: unknown): ValidatedKanbanInput {
  return KanbanInputSchema.parse(input);
}
