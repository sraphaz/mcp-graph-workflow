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
 * Canonical readiness check/report schemas — single source of truth.
 * Phase-specific schemas (Design, Validation, Review, Handoff, Listener)
 * should use these as base or re-export.
 */

import { z } from "zod/v4";
import { GradeSchema } from "./grade-schema.js";

export const ReadinessSeveritySchema = z.enum(["required", "recommended"]);
export type ReadinessSeverity = z.infer<typeof ReadinessSeveritySchema>;

export const BaseReadinessCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  details: z.string(),
  severity: ReadinessSeveritySchema,
});
export type BaseReadinessCheck = z.infer<typeof BaseReadinessCheckSchema>;

export const BaseReadinessReportSchema = z.object({
  checks: z.array(BaseReadinessCheckSchema),
  ready: z.boolean(),
  score: z.number().min(0).max(100),
  grade: GradeSchema,
  summary: z.string(),
});
export type BaseReadinessReport = z.infer<typeof BaseReadinessReportSchema>;
