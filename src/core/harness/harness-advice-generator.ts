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
 * Harness Advice Generator — per-file remediation advice for dimensions below threshold.
 *
 * Takes scan breakdown and file-level violations; returns specific file paths
 * grouped by dimension (top 10 per dimension, deduplicated).
 * Dimensions with score >= 70 are omitted from the output.
 */

import type { ViolationDetail, HarnessDimension } from "./violation-detail.js";
import type { DimensionBreakdown } from "./harnessability-score.js";

export interface AdviceFile {
  file: string;
  issue: string;
  suggestion: string;
}

export interface AdviceEntry {
  dimension: string;
  score: number;
  files: AdviceFile[];
}

export interface AdviceInput {
  breakdown: Record<string, DimensionBreakdown>;
  typeViolations: ViolationDetail[];
  testViolations: ViolationDetail[];
}

const THRESHOLD = 70;
const MAX_FILES_PER_DIM = 10;

const DIMENSION_SUGGESTIONS: Partial<Record<HarnessDimension, string>> = {
  types: "Replace 'any' with explicit types. Search: grep -rn \": any\\|as any\" src/",
  tests: "Create test file in src/tests/ matching the module name (e.g. foo.ts → foo.test.ts)",
  naming: "Rename generic identifiers (data, result, temp, val) to descriptive names",
  errors: "Use typed errors from utils/errors.ts; remove empty catch blocks",
  context: "Add /** JSDoc */ comment to exported functions",
};

/**
 * Build per-file advice entries for dimensions below the 70-score threshold.
 * Returns an empty array when all dimensions are healthy.
 */
export function buildAdviceEntries(input: AdviceInput): AdviceEntry[] {
  const entries: AdviceEntry[] = [];

  for (const [dim, info] of Object.entries(input.breakdown)) {
    if (info.score >= THRESHOLD) continue;

    let violations: ViolationDetail[];
    if (dim === "types") {
      violations = input.typeViolations;
    } else if (dim === "tests") {
      violations = input.testViolations;
    } else {
      // For dimensions without violation arrays, skip (generic advice only)
      continue;
    }

    // Deduplicate by file path
    const seen = new Set<string>();
    const files: AdviceFile[] = [];

    for (const v of violations) {
      if (seen.has(v.file)) continue;
      seen.add(v.file);
      if (files.length >= MAX_FILES_PER_DIM) break;

      files.push({
        file: v.file,
        issue: `${dim} violation: ${v.evidence} (line ${v.line})`,
        suggestion: DIMENSION_SUGGESTIONS[v.dimension as HarnessDimension]
          ?? `Fix ${v.violationType} in ${v.file}`,
      });
    }

    if (files.length > 0) {
      entries.push({ dimension: dim, score: info.score, files });
    }
  }

  return entries;
}
