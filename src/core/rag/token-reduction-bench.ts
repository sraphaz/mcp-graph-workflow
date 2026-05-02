/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 17 — Embeddings ONNX + Hybrid Retrieval.
 * Token reduction bench helper. Drives a corpus of PRD samples through
 * before/after context-assembly and reports p50/p95/mean reduction so
 * EPIC 17 hybrid-retrieval can be validated against the AC ("token
 * reduction p50/p95 em 50 PRDs samples").
 *
 * Pure compute — the I/O of feeding actual PRDs through assembleContext
 * lives in the script that calls this helper.
 */

import { InvalidArgumentError } from "../utils/errors.js";

export interface TokenReductionSample {
  /** Tokens before applying the new context-assembly path. */
  before: number;
  /** Tokens after applying the new path. */
  after: number;
}

export interface TokenReductionStats {
  sampleCount: number;
  p50Before: number;
  p95Before: number;
  p50After: number;
  p95After: number;
  p50Reduction: number;
  p95Reduction: number;
  meanReduction: number;
}

/** percentile — auto-generated description placeholder. */
export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) {
    throw new InvalidArgumentError("percentile: empty array");
  }
  const clamped = Math.max(0, Math.min(1, q));
  const sorted = [...values].sort((a, b) => a - b);
  // After the empty-array guard above, sorted has at least one element so
  // the indexed reads below cannot produce undefined.
  const first = sorted[0] as number;
  if (sorted.length === 1) return first;
  const rank = clamped * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const sLo = sorted[lo] as number;
  if (lo === hi) return sLo;
  const sHi = sorted[hi] as number;
  const frac = rank - lo;
  return sLo * (1 - frac) + sHi * frac;
}

function reductionOf(sample: TokenReductionSample): number {
  if (sample.before <= 0) return 0;
  return (sample.before - sample.after) / sample.before;
}

/** computeTokenReductionStats — auto-generated description placeholder. */
export function computeTokenReductionStats(
  samples: readonly TokenReductionSample[],
): TokenReductionStats {
  if (samples.length === 0) {
    return {
      sampleCount: 0,
      p50Before: 0,
      p95Before: 0,
      p50After: 0,
      p95After: 0,
      p50Reduction: 0,
      p95Reduction: 0,
      meanReduction: 0,
    };
  }

  const before = samples.map((s) => s.before);
  const after = samples.map((s) => s.after);
  const reductions = samples.map(reductionOf);
  const sumReduction = reductions.reduce((a, b) => a + b, 0);

  return {
    sampleCount: samples.length,
    p50Before: percentile(before, 0.5),
    p95Before: percentile(before, 0.95),
    p50After: percentile(after, 0.5),
    p95After: percentile(after, 0.95),
    p50Reduction: percentile(reductions, 0.5),
    p95Reduction: percentile(reductions, 0.95),
    meanReduction: sumReduction / samples.length,
  };
}
