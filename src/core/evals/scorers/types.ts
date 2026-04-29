/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset.
 * Common scorer types.
 */

export interface ScorerResult {
  /** Continuous score in [0,1]. 1 = perfect match. */
  score: number;
  /** Boolean pass. Generally score >= passThreshold; default 1 for exact/regex. */
  passed: boolean;
  /** Optional explanation (failed regex, diff hint, etc.). */
  details?: string;
}

export interface Scorer<I> {
  readonly kind: string;
  score(input: I): ScorerResult;
}

export interface AsyncScorer<I> {
  readonly kind: string;
  score(input: I): Promise<ScorerResult>;
}
