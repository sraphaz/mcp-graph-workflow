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
 * Validator validation schemas — Zod boundary validation for MCP tool inputs.
 */

import { z } from "zod/v4";

export const ValidationInputSchema = z.object({
  action: z.enum(["ac", "dor", "dod", "integrity", "flow"]).optional(),
  nodeId: z.string().optional(),
  strict: z.boolean().optional(),
});

export type ValidatedValidationInput = z.infer<typeof ValidationInputSchema>;

/** validateValidationInput — auto-generated description placeholder. */
export function validateValidationInput(input: unknown): ValidatedValidationInput {
  return ValidationInputSchema.parse(input);
}
