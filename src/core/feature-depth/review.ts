/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Pre-push / PR review of feature-depth deltas between two refs.
 *
 * Strategy: shell out to the Go binary at HEAD with --baseline pointed
 * at a JSON snapshot of the merge-base, parse the resulting diff, and
 * decide whether the net regression crosses the threshold.
 *
 * Pure orchestration — git operations + go run are injected as deps so
 * the function is unit-testable without a real repo.
 */

export interface FileDelta {
  readonly path: string;
  readonly module: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
  readonly testLocDelta?: number;
}

export interface ReviewResult {
  readonly ok: boolean;
  readonly improvers: FileDelta[];
  readonly regressions: FileDelta[];
  readonly netDelta: number;
  readonly worstRegression: FileDelta | null;
  readonly threshold: number;
  readonly summary: string;
}

export interface ReviewInput {
  readonly improvers: FileDelta[];
  readonly regressions: FileDelta[];
  /**
   * Maximum tolerated drop on a single file (any file regressing
   * beyond this fails the review). Default 5pts — same as
   * DEFAULT_REGRESSION_THRESHOLD.
   */
  readonly singleFileThreshold?: number;
  /**
   * Maximum tolerated NET regression (sum of regressions minus sum
   * of improvements). Default 0 — net must be non-negative.
   */
  readonly netThreshold?: number;
}

export const DEFAULT_REVIEW_SINGLE_THRESHOLD = 5;
export const DEFAULT_REVIEW_NET_THRESHOLD = 0;

/**
 * Decide whether a set of file-level deltas passes review.
 *
 * Two failure modes:
 *   1. Any single file regresses more than `singleFileThreshold` pts
 *      → fail (caps blast radius of one bad file)
 *   2. Net delta (sum improvers - sum regressions) is below
 *      -netThreshold → fail (catches "1 huge regression vs 10 trivial
 *      improvements" patterns)
 */
export function evaluateReview(input: ReviewInput): ReviewResult {
  const singleFileThreshold = input.singleFileThreshold ?? DEFAULT_REVIEW_SINGLE_THRESHOLD;
  const netThreshold = input.netThreshold ?? DEFAULT_REVIEW_NET_THRESHOLD;

  const sumImprovers = input.improvers.reduce((acc, f) => acc + f.delta, 0);
  const sumRegressions = input.regressions.reduce((acc, f) => acc + f.delta, 0); // negative
  const netDelta = sumImprovers + sumRegressions;

  let worstRegression: FileDelta | null = null;
  for (const r of input.regressions) {
    if (worstRegression === null || r.delta < worstRegression.delta) {
      worstRegression = r;
    }
  }

  const singleFileFailed =
    worstRegression !== null && -worstRegression.delta > singleFileThreshold;
  const netFailed = netDelta < -netThreshold;
  const ok = !singleFileFailed && !netFailed;

  let summary = `Δ net: ${netDelta >= 0 ? "+" : ""}${netDelta.toFixed(1)} ` +
    `(${input.improvers.length} improvers, ${input.regressions.length} regressions)`;
  if (singleFileFailed && worstRegression) {
    summary += ` — single-file fail: ${worstRegression.path} dropped ${worstRegression.delta.toFixed(1)} pts`;
  } else if (netFailed) {
    summary += ` — net fail: below threshold ${-netThreshold}`;
  }

  return {
    ok,
    improvers: input.improvers,
    regressions: input.regressions,
    netDelta,
    worstRegression,
    threshold: singleFileThreshold,
    summary,
  };
}
