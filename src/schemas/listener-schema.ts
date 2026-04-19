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

// ── Backlog Health ──

export const StaleTaskSchema = z.object({
  nodeId: z.string(),
  title: z.string(),
  daysInBacklog: z.number().min(0),
});

export const TechDebtIndicatorSchema = z.object({
  nodeId: z.string(),
  title: z.string(),
  keywords: z.array(z.string()),
});

export const BacklogAgingSchema = z.object({
  avgDays: z.number().min(0),
  maxDays: z.number().min(0),
});

export const BacklogHealthReportSchema = z.object({
  backlogCount: z.number().min(0),
  readyCount: z.number().min(0),
  staleTasks: z.array(StaleTaskSchema),
  techDebtIndicators: z.array(TechDebtIndicatorSchema),
  cleanForNewCycle: z.boolean(),
  typeDistribution: z.record(z.string(), z.number()),
  priorityDistribution: z.record(z.string(), z.number()),
  aging: BacklogAgingSchema,
});

// ── Listener Readiness ──

export const ListenerReadinessCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  details: z.string(),
  severity: ReadinessSeveritySchema,
});

export const ListenerReadinessReportSchema = z.object({
  checks: z.array(ListenerReadinessCheckSchema),
  ready: z.boolean(),
  score: z.number().min(0).max(100),
  grade: AdrGradeSchema,
  summary: z.string(),
});

export type StaleTask = z.infer<typeof StaleTaskSchema>;
export type TechDebtIndicator = z.infer<typeof TechDebtIndicatorSchema>;
export type BacklogAging = z.infer<typeof BacklogAgingSchema>;
export type BacklogHealthReport = z.infer<typeof BacklogHealthReportSchema>;
export type ListenerReadinessCheck = z.infer<typeof ListenerReadinessCheckSchema>;
export type ListenerReadinessReport = z.infer<typeof ListenerReadinessReportSchema>;
