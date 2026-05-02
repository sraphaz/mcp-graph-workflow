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

/** validateContextQuery — auto-generated description placeholder. */
export function validateContextQuery(input: unknown): ValidatedContextQuery {
  return ContextQuerySchema.parse(input);
}

/** validateRagContextInput — auto-generated description placeholder. */
export function validateRagContextInput(input: unknown): ValidatedRagContextInput {
  return RagContextInputSchema.parse(input);
}
