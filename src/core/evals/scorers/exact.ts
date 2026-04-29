/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset.
 * Exact-match scorer with optional trim and case-insensitive comparison.
 */

import type { Scorer, ScorerResult } from "./types.js";

export interface ExactInput {
  output: string;
  expected: string;
  /** Trim leading/trailing whitespace before compare (default true). */
  trim?: boolean;
  /** Case-sensitive compare (default true). */
  caseSensitive?: boolean;
}

function normalize(s: string, trim: boolean, caseSensitive: boolean): string {
  let out = trim ? s.trim() : s;
  if (!caseSensitive) out = out.toLowerCase();
  return out;
}

export const exactScorer: Scorer<ExactInput> = {
  kind: "exact",
  score(input: ExactInput): ScorerResult {
    const trim = input.trim !== false;
    const caseSensitive = input.caseSensitive !== false;
    const a = normalize(input.output, trim, caseSensitive);
    const b = normalize(input.expected, trim, caseSensitive);
    const matched = a === b;
    return { score: matched ? 1 : 0, passed: matched };
  },
};
