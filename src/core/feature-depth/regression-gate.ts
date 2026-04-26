/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Pure regression gate — compares a file's prior baseline score
 * against its current score and decides whether the drop crosses
 * the warning threshold.
 *
 * Used inside finish_task: for each touched file, look up the prior
 * row in feature_depth_baselines, compute the current score via
 * scoreFile, and call this gate. Regressions are surfaced as DoD
 * warnings (advisory by default; strict mode promotes to blockers).
 *
 * Pattern mirrors src/core/harness/harness-preflight.ts —
 * non-blocking decision struct, caller decides what to do with it.
 */

export const DEFAULT_REGRESSION_THRESHOLD = 5;

export interface RegressionInput {
  readonly relPath: string;
  readonly before: number | null; // null = no baseline (fresh file)
  readonly after: number;
  readonly threshold?: number;
}

export interface RegressionResult {
  readonly regressed: boolean;
  readonly delta: number;
  readonly message: string;
  readonly threshold: number;
}

export function checkFeatureDepthRegression(
  input: RegressionInput,
): RegressionResult {
  const threshold = input.threshold ?? DEFAULT_REGRESSION_THRESHOLD;

  // No baseline — first time this file is being scored. Cannot regress
  // against nothing. Caller will UPSERT the baseline after finish_task
  // succeeds so the next round has something to compare to.
  if (input.before === null) {
    return {
      regressed: false,
      delta: 0,
      message: "",
      threshold,
    };
  }

  const delta = input.after - input.before;
  const regressed = -delta > threshold; // drop beyond threshold

  const message = regressed
    ? `feature_depth: ${input.relPath} regressed ${delta.toFixed(1)} pts ` +
      `(${input.before.toFixed(1)} → ${input.after.toFixed(1)}, threshold ${threshold})`
    : "";

  return { regressed, delta, message, threshold };
}
