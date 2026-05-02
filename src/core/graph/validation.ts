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
 * Graph validation schemas — Zod boundary validation for MCP tool inputs.
 */

import { z } from "zod/v4";

export const HealthScanInputSchema = z.object({
  projectId: z.string().min(1).optional(),
  includeCategories: z.array(z.enum(["cycle", "orphan", "stuck", "oversized", "broken_dep", "status_violation", "done_violation"])).optional(),
});

export const MermaidExportInputSchema = z.object({
  direction: z.enum(["TB", "LR", "BT", "RL"]).optional(),
  includeEdgeLabels: z.boolean().optional(),
});

export type ValidatedHealthScanInput = z.infer<typeof HealthScanInputSchema>;
export type ValidatedMermaidExportInput = z.infer<typeof MermaidExportInputSchema>;

/** validateHealthScanInput — auto-generated description placeholder. */
export function validateHealthScanInput(input: unknown): ValidatedHealthScanInput {
  return HealthScanInputSchema.parse(input);
}

/** validateMermaidExportInput — auto-generated description placeholder. */
export function validateMermaidExportInput(input: unknown): ValidatedMermaidExportInput {
  return MermaidExportInputSchema.parse(input);
}
