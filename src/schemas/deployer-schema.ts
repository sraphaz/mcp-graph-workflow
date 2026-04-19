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

// ── Deploy Readiness ──

export const DeployReadinessCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  details: z.string(),
  severity: ReadinessSeveritySchema,
});

export const DeployReadinessReportSchema = z.object({
  checks: z.array(DeployReadinessCheckSchema),
  ready: z.boolean(),
  score: z.number().min(0).max(100),
  grade: AdrGradeSchema,
  summary: z.string(),
});

export type DeployReadinessCheck = z.infer<typeof DeployReadinessCheckSchema>;
export type DeployReadinessReport = z.infer<typeof DeployReadinessReportSchema>;
