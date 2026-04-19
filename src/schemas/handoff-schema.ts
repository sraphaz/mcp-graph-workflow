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
import { AdrGradeSchema, ReadinessSeveritySchema } from "./designer-schema.js";

// ── Doc Completeness ──

export const DocCompletenessNodeSchema = z.object({
  nodeId: z.string(),
  title: z.string(),
});

export const DocCompletenessReportSchema = z.object({
  descriptionsPresent: z.number().min(0),
  totalNodes: z.number().min(0),
  coverageRate: z.number().min(0).max(100),
  nodesWithoutDescription: z.array(DocCompletenessNodeSchema),
});

// ── Handoff Readiness ──

export const HandoffReadinessCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  details: z.string(),
  severity: ReadinessSeveritySchema,
});

export const HandoffReadinessReportSchema = z.object({
  checks: z.array(HandoffReadinessCheckSchema),
  ready: z.boolean(),
  score: z.number().min(0).max(100),
  grade: AdrGradeSchema,
  summary: z.string(),
});

export type DocCompletenessNode = z.infer<typeof DocCompletenessNodeSchema>;
export type DocCompletenessReport = z.infer<typeof DocCompletenessReportSchema>;
export type HandoffReadinessCheck = z.infer<typeof HandoffReadinessCheckSchema>;
export type HandoffReadinessReport = z.infer<typeof HandoffReadinessReportSchema>;
