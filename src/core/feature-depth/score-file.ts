/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * File-level feature-depth scorer (TS port of
 * tools/feature-depth/analyzer/file.go).
 *
 * Used inside the lifecycle hot path (finish_task gate, plan_sprint
 * risk index). Six dimensions, weights summing to 1.0, all computed
 * via regex over file content — O(n) in source LOC, ~5ms per file.
 *
 * The Go implementation is the canonical reference for standalone
 * audit. This TS module mirrors it intentionally; the test suite has
 * a drift detector that flags weight or behavior divergence.
 */

import {
  calcEdgeCases,
  calcErrorHandling,
  calcTypeSafety,
  calcValidation,
} from "./regex-helpers.js";

export interface FileScoreInput {
  readonly relPath: string;
  readonly module: string;
  readonly content: string;
  readonly sourceLoc: number;
  readonly testLoc: number;
}

export interface FileScoreDimensions {
  readonly testDensity: number; // 0-1 ratio (capped at 1)
  readonly hasTest: boolean;
  readonly errorHandling: number; // 0-100
  readonly typeSafety: number; // 0-100
  readonly validationCoverage: number; // 0-100
  readonly edgeCaseHandling: number; // 0-100
}

export interface FileScore {
  readonly relPath: string;
  readonly module: string;
  readonly score: number; // 0-100 composite
  readonly dimensions: FileScoreDimensions;
}

export interface FileWeights {
  readonly testDensity: number;
  readonly hasTest: number;
  readonly errorHandling: number;
  readonly typeSafety: number;
  readonly validationCoverage: number;
  readonly edgeCaseHandling: number;
}

/**
 * Default weights — must sum to 1.0. Keep in lockstep with
 * tools/feature-depth/analyzer/file.go::DefaultFileWeights.
 *
 * Calibration:
 *   testDensity 0.30  — heaviest single signal; the spread-strategy fix
 *   hasTest     0.15  — binary "did anyone write a test"
 *   typeSafety  0.20  — `any` is a strong code-quality marker
 *   errorH      0.15
 *   validation  0.10
 *   edgeCases   0.10
 */
export const DEFAULT_FILE_WEIGHTS: FileWeights = {
  testDensity: 0.30,
  hasTest: 0.15,
  errorHandling: 0.15,
  typeSafety: 0.20,
  validationCoverage: 0.10,
  edgeCaseHandling: 0.10,
};

/**
 * Score a single source file. The optional `coveragePercent` (0-100)
 * overrides the LOC-ratio TestDensity heuristic when provided —
 * real % statements covered is strictly better signal. Pass nothing
 * to keep the LOC heuristic.
 */
export function scoreFile(
  input: FileScoreInput,
  coveragePercent?: number,
): FileScore {
  const hasTest = input.testLoc > 0;

  let density = 0;
  if (input.sourceLoc > 0 && input.testLoc > 0) {
    density = input.testLoc / input.sourceLoc;
    if (density > 1) density = 1;
  }
  if (typeof coveragePercent === "number" && coveragePercent > 0) {
    density = coveragePercent / 100;
    if (density > 1) density = 1;
  }

  const errH = calcErrorHandling(input.content);
  const typeS = calcTypeSafety(input.content);
  const validation = calcValidation(input.content);
  const edges = calcEdgeCases(input.content);

  const wVar = DEFAULT_FILE_WEIGHTS;
  const hasTestScore = hasTest ? 100 : 0;

  const score =
    density * 100 * wVar.testDensity +
    hasTestScore * wVar.hasTest +
    errH * wVar.errorHandling +
    typeS * wVar.typeSafety +
    validation * wVar.validationCoverage +
    edges * wVar.edgeCaseHandling;

  return {
    relPath: input.relPath,
    module: input.module,
    score: clamp(score, 0, 100),
    dimensions: {
      testDensity: density,
      hasTest,
      errorHandling: errH,
      typeSafety: typeS,
      validationCoverage: validation,
      edgeCaseHandling: edges,
    },
  };
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
