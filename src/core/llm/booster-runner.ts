/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T07 — Booster runner with safety gate.
 *
 * Runs a Tier 0 transform (regex/AST) only when the file has at least one
 * associated test file. Falls through to Tier 1 on:
 *   - missing test coverage (safety gate)
 *   - booster throw / miss (transform unsafe)
 *
 * Pure: caller injects the booster, telemetry sink, and the test-coverage
 * lookup. Result is deterministic for given inputs.
 */

import type { BoosterResult } from "./tier-router.js";

export interface RunBoosterInput<T> {
  filePath: string;
  testFiles: string[];
  booster: () => T | undefined;
  /** Sink for run telemetry; called once per attempt regardless of outcome. */
  telemetry?: (record: BoosterTelemetryRecord) => void;
}

export interface BoosterTelemetryRecord {
  filePath: string;
  outcome: "hit" | "miss" | "blocked-no-tests" | "error";
  durationMs: number;
  hasTests: boolean;
  errorMessage?: string;
}

export type BoosterRunOutcome<T> = BoosterResult<T> & {
  telemetry: BoosterTelemetryRecord;
};

/** True iff at least one test file is associated with the source file. */
export function hasAssociatedTests(testFiles: string[]): boolean {
  return testFiles.length > 0;
}

export function runBooster<T>(input: RunBoosterInput<T>): BoosterRunOutcome<T> {
  const start = Date.now();
  const hasTests = hasAssociatedTests(input.testFiles);

  if (!hasTests) {
    const record: BoosterTelemetryRecord = {
      filePath: input.filePath,
      outcome: "blocked-no-tests",
      durationMs: 0,
      hasTests: false,
    };
    input.telemetry?.(record);
    return {
      hit: false,
      reason: "booster:safety-gate:no-test-coverage",
      telemetry: record,
    };
  }

  try {
    const out = input.booster();
    const durationMs = Date.now() - start;
    if (out === undefined) {
      const record: BoosterTelemetryRecord = {
        filePath: input.filePath,
        outcome: "miss",
        durationMs,
        hasTests: true,
      };
      input.telemetry?.(record);
      return { hit: false, reason: "booster:no-match", telemetry: record };
    }
    const record: BoosterTelemetryRecord = {
      filePath: input.filePath,
      outcome: "hit",
      durationMs,
      hasTests: true,
    };
    input.telemetry?.(record);
    return { hit: true, output: out, reason: "booster:applied", telemetry: record };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const record: BoosterTelemetryRecord = {
      filePath: input.filePath,
      outcome: "error",
      durationMs: Date.now() - start,
      hasTests: true,
      errorMessage: message,
    };
    input.telemetry?.(record);
    return {
      hit: false,
      reason: `booster:error:${message}`,
      telemetry: record,
    };
  }
}
