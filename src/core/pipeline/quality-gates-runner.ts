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
 * Quality Gates Runner — executes quality gate analyze modes
 * and aggregates results for finish_task integration.
 */

import { checkSecurityScan } from "../analyzer/security-scanner.js";
import { checkCodeQuality } from "../analyzer/code-quality-checker.js";
import { checkTestCoverage } from "../analyzer/test-coverage-checker.js";
import { checkObservability } from "../analyzer/observability-checker.js";
import { scoreToGrade } from "../utils/grading.js";
import { logger } from "../utils/logger.js";

export interface QualityGatesResult {
  modes: string[];
  scores: Record<string, number>;
  overallScore: number;
  overallGrade: string;
  warnings: string[];
}

type GateRunner = (projectPath: string) => { score: number; grade: string; passed: boolean };

const GATE_RUNNERS: Record<string, GateRunner> = {
  security_scan: (p) => {
    const r = checkSecurityScan(p);
    return { score: r.score, grade: r.grade, passed: r.passed };
  },
  code_quality: (p) => {
    const r = checkCodeQuality(p);
    return { score: r.score, grade: r.grade, passed: r.passed };
  },
  test_coverage: (p) => {
    const r = checkTestCoverage(p);
    return { score: r.score, grade: r.grade, passed: r.passed };
  },
  observability_check: (p) => {
    const r = checkObservability(p);
    return { score: r.score, grade: r.grade, passed: r.passed };
  },
};

/**
 * Run specified quality gates and aggregate results.
 * Returns null if no gates specified.
 */
export function runQualityGates(
  projectPath: string,
  gates: string[],
): QualityGatesResult | null {
  if (gates.length === 0) return null;

  const scores: Record<string, number> = {};
  const warnings: string[] = [];

  for (const gate of gates) {
    const runner = GATE_RUNNERS[gate];

    if (!runner) {
      scores[gate] = 0;
      warnings.push(`Unknown quality gate: ${gate}`);
      continue;
    }

    try {
      const result = runner(projectPath);
      scores[gate] = result.score;

      if (result.score < 50) {
        warnings.push(`Quality gate '${gate}' scored ${result.score}/100 (${result.grade}) — below advisory threshold`);
      }
    } catch (err) {
      scores[gate] = 0;
      warnings.push(`Quality gate '${gate}' failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const scoreValues = Object.values(scores);
  const overallScore = scoreValues.length > 0
    ? Math.round(scoreValues.reduce((sum, s) => sum + s, 0) / scoreValues.length)
    : 0;
  const overallGrade = scoreToGrade(overallScore);

  logger.info("quality-gates:complete", {
    gates: gates.length,
    overallScore,
    overallGrade,
    warnings: warnings.length,
  });

  return {
    modes: gates,
    scores,
    overallScore,
    overallGrade,
    warnings,
  };
}
