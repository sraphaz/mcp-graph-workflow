/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset.
 * Regex-match scorer. `expected` is the regex source; `flags` is optional.
 */

import type { Scorer, ScorerResult } from "./types.js";

export interface RegexInput {
  output: string;
  /** Regex source pattern (no surrounding slashes). */
  expected: string;
  /** Standard JS regex flags (e.g. "i", "im"). */
  flags?: string;
}

export const regexScorer: Scorer<RegexInput> = {
  kind: "regex",
  score(input: RegexInput): ScorerResult {
    let re: RegExp;
    try {
      // §EPIC-18 — RegexScorer's whole purpose is to evaluate a
      // user-supplied pattern against output. The pattern is treated as
      // structured eval input (caller controls the suite). The
      // try/catch above contains any malformed-regex error.
      // eslint-disable-next-line security/detect-non-literal-regexp
      re = new RegExp(input.expected, input.flags);
    } catch (err) {
      return {
        score: 0,
        passed: false,
        details: `invalid regex: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    const matched = re.test(input.output);
    return { score: matched ? 1 : 0, passed: matched };
  },
};
