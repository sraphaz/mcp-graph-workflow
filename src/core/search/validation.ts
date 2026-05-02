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
 * Search validation schemas — Zod boundary validation for MCP tool inputs.
 */

import { z } from "zod/v4";

export const SearchQuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
  type: z.string().optional(),
  status: z.string().optional(),
});

export type ValidatedSearchQuery = z.infer<typeof SearchQuerySchema>;

/** validateSearchQuery — auto-generated description placeholder. */
export function validateSearchQuery(input: unknown): ValidatedSearchQuery {
  return SearchQuerySchema.parse(input);
}
