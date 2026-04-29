/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset.
 * Citation-coverage scorer — wraps citation-extractor.
 *
 * - With `expected` (array of citation IDs): score = fraction found / expected.
 * - Without `expected`: passed = output contains ≥1 citation; score 0/1.
 */

import { extractCitations, hasCitation } from "../../citations/citation-extractor.js";
import type { Scorer, ScorerResult } from "./types.js";

export interface CitationCoverageInput {
  output: string;
  expected?: string[];
  /** Pass threshold on 0..1 fraction. Default 1.0 (all expected must be present). */
  threshold?: number;
}

export const citationCoverageScorer: Scorer<CitationCoverageInput> = {
  kind: "citation-coverage",
  score(input: CitationCoverageInput): ScorerResult {
    if (!input.expected || input.expected.length === 0) {
      const ok = hasCitation(input.output);
      return { score: ok ? 1 : 0, passed: ok };
    }
    const present = new Set(extractCitations(input.output));
    const found = input.expected.filter((c) => present.has(c)).length;
    const score = found / input.expected.length;
    const threshold = input.threshold ?? 1;
    return {
      score,
      passed: score >= threshold,
      details: `${found}/${input.expected.length} expected citations present`,
    };
  },
};
