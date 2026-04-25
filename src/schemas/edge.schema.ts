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

import { z } from "zod/v4";

export const RelationTypeSchema = z.enum([
  "parent_of", "child_of", "depends_on", "blocks",
  "related_to", "priority_over", "implements", "derived_from",
  // Game-specific / advanced relation types
  "provides", "consumes", "requires_asset",
  // Decomposition
  "decomposed_into",
]);

export const GraphEdgeSchema = z.object({
  id: z.string().max(100),
  from: z.string().max(100),
  to: z.string().max(100),
  relationType: RelationTypeSchema,
  weight: z.number().min(0).max(1).optional(),
  reason: z.string().max(2000).optional(),
  metadata: z.record(z.string().max(100), z.unknown()).optional(),
  createdAt: z.string(),
});
