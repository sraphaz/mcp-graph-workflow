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
 * Trace Diff — semantic comparison of two RAG pipeline runs.
 *
 * Compares two TraceSnapshots for the same query, producing:
 *   - Added documents (in B, not in A)
 *   - Removed documents (in A, not in B)
 *   - Score deltas per document present in both
 *   - isDeterministic flag + determinismSeal when both runs are bit-identical
 *
 * Refuses to compare traces from different queries (IncompatibleQueryError).
 */

import { McpGraphError } from "../utils/errors.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TraceDoc {
  readonly docId: string;
  readonly score: number;
}

export interface TraceSnapshot {
  readonly traceId: string;
  readonly query: string;
  readonly timestamp: string;
  readonly results: readonly TraceDoc[];
}

export interface ScoreDelta {
  readonly docId: string;
  /** score_B - score_A */
  readonly delta: number;
  readonly scoreA: number;
  readonly scoreB: number;
}

export interface TraceDiff {
  /** Documents in B that were not in A */
  readonly added: readonly TraceDoc[];
  /** Documents in A that were not in B */
  readonly removed: readonly TraceDoc[];
  /** Score changes for docs present in both traces */
  readonly scoreDeltas: readonly ScoreDelta[];
  /** True only when added=[], removed=[], and all deltas are zero */
  readonly isDeterministic: boolean;
  /** Present and non-empty only when isDeterministic=true */
  readonly determinismSeal?: string;
}

// ── Typed error ────────────────────────────────────────────────────────────

export class IncompatibleQueryError extends McpGraphError {
  constructor(queryA: string, queryB: string) {
    super(
      `Cannot diff traces from different queries. ` +
        `Trace A query: "${queryA}" — Trace B query: "${queryB}". ` +
        `Semantic comparison across different queries is undefined.`,
    );
    this.name = "IncompatibleQueryError";
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Compare two RAG traces for the same query.
 * Throws IncompatibleQueryError when queries differ.
 */
export function diffTraces(a: TraceSnapshot, b: TraceSnapshot): TraceDiff {
  if (a.query !== b.query) {
    throw new IncompatibleQueryError(a.query, b.query);
  }

  const aMap = new Map<string, number>(a.results.map((d) => [d.docId, d.score]));
  const bMap = new Map<string, number>(b.results.map((d) => [d.docId, d.score]));

  const added: TraceDoc[] = [];
  const removed: TraceDoc[] = [];
  const scoreDeltas: ScoreDelta[] = [];

  for (const [docId, scoreB] of bMap) {
    const scoreA = aMap.get(docId);
    if (scoreA === undefined) {
      added.push({ docId, score: scoreB });
    } else {
      scoreDeltas.push({ docId, delta: scoreB - scoreA, scoreA, scoreB });
    }
  }

  for (const [docId, scoreA] of aMap) {
    if (!bMap.has(docId)) {
      removed.push({ docId, score: scoreA });
    }
  }

  const allDeltasZero = scoreDeltas.every((sd) => Math.abs(sd.delta) < Number.EPSILON * 1000);
  const isDeterministic = added.length === 0 && removed.length === 0 && allDeltasZero;

  return {
    added,
    removed,
    scoreDeltas,
    isDeterministic,
    determinismSeal: isDeterministic
      ? `deterministic:${a.query}:${a.results.length}docs`
      : undefined,
  };
}
