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
 * RAG Query Trace — full observability schema for a single RAG query execution.
 *
 * Records all candidates considered (with score + selected flag), reranking
 * passes, and the final decision. Validated via Zod v4.
 *
 * Also provides applyRetentionPolicy to rotate traces older than N days.
 */

import { z } from "zod/v4";

// ── Candidate schema ───────────────────────────────────────────────────────

export const CandidateTraceSchema = z.object({
  docId: z.string(),
  score: z.number(),
  selected: z.boolean(),
  snippet: z.string(),
});
export type CandidateTrace = z.infer<typeof CandidateTraceSchema>;

// ── Reranking pass schema ──────────────────────────────────────────────────

export const RerankingPassSchema = z.object({
  passIndex: z.number().int(),
  algorithm: z.string(),
  inputCount: z.number().int(),
  outputCount: z.number().int(),
  durationMs: z.number(),
});
export type RerankingPass = z.infer<typeof RerankingPassSchema>;

// ── Final decision schema ──────────────────────────────────────────────────

export const FinalDecisionSchema = z.object({
  selectedDocIds: z.array(z.string()),
  rationale: z.string(),
});
export type FinalDecision = z.infer<typeof FinalDecisionSchema>;

// ── Full query trace schema ────────────────────────────────────────────────

export const RagQueryTraceSchema = z.object({
  traceId: z.string(),
  query: z.string(),
  timestamp: z.string(),
  candidates: z.array(CandidateTraceSchema),
  selectedCount: z.number().int(),
  totalCandidates: z.number().int(),
  rerankingPasses: z.array(RerankingPassSchema),
  finalDecision: FinalDecisionSchema,
});
export type RagQueryTrace = z.infer<typeof RagQueryTraceSchema>;

// ── Retention policy ───────────────────────────────────────────────────────

export interface RetentionOptions {
  /** Maximum age in days before a trace is rotated out. */
  readonly retentionDays: number;
  /** Reference point for age calculation (default: now). */
  readonly now?: Date;
}

export interface RetentionResult {
  readonly retained: RagQueryTrace[];
  readonly rotatedCount: number;
}

/**
 * Apply a retention policy to a list of traces.
 * Traces whose timestamp is older than retentionDays are removed.
 * Returns the retained traces and the count of rotated (removed) ones.
 */
export function applyRetentionPolicy(
  traces: readonly RagQueryTrace[],
  opts: RetentionOptions,
): RetentionResult {
  const now = opts.now ?? new Date();
  const cutoffMs = now.getTime() - opts.retentionDays * 24 * 60 * 60 * 1000;

  const retained: RagQueryTrace[] = [];
  let rotatedCount = 0;

  for (const trace of traces) {
    const traceMs = new Date(trace.timestamp).getTime();
    if (traceMs < cutoffMs) {
      rotatedCount++;
    } else {
      retained.push(trace);
    }
  }

  return { retained, rotatedCount };
}
