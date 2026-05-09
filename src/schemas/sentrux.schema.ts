/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-sentrux-adoption — Task 1.3: Zod v4 schemas for Sentrux MCP tools.
 */

import { z } from "zod/v4";

export const SentruxScanResultSchema = z.object({
  runId: z.string(),
  issuesFound: z.number().int().nonnegative(),
  severity: z.enum(["ok", "warn", "error"]),
  timestamp: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type SentruxScanResult = z.infer<typeof SentruxScanResultSchema>;

export const SentruxSessionStartResultSchema = z.object({
  sessionId: z.string(),
  startedAt: z.string(),
  baseline: z.record(z.string(), z.unknown()).optional(),
});

export type SentruxSessionStartResult = z.infer<typeof SentruxSessionStartResultSchema>;

export const SentruxSessionEndResultSchema = z.object({
  sessionId: z.string(),
  endedAt: z.string(),
  delta: z.record(z.string(), z.unknown()),
  issuesDelta: z.number().int(),
});

export type SentruxSessionEndResult = z.infer<typeof SentruxSessionEndResultSchema>;

export const SentruxViolationSchema = z.object({
  path: z.string(),
  rule: z.string(),
  severity: z.enum(["error", "warn", "info"]),
  message: z.string().optional(),
});

export type SentruxViolation = z.infer<typeof SentruxViolationSchema>;

export const SentruxCheckRulesResultSchema = z.object({
  violations: z.array(SentruxViolationSchema),
  totalCount: z.number().int().nonnegative(),
});

export type SentruxCheckRulesResult = z.infer<typeof SentruxCheckRulesResultSchema>;
