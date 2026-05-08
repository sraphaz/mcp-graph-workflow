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
 * Test Gate — TDD validation gate for finish_task pipeline
 *
 * Runs associated test files before allowing a task to be marked done.
 * Implements the Closed-Loop Feedback (Wiener 1948) and DORA Shift-Left.
 *
 * Modes:
 * - strict: blocks finish_task if tests fail
 * - advisory: reports failures but doesn't block (default)
 * - off: skips test validation entirely
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { runTests, type TestError } from "./test-runner.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "test-gate.ts" });

// ── Types ───────────────────────────────────────────────

export type TestGateMode = "strict" | "advisory" | "off";

export interface TestGateResult {
  status: "passed" | "failed" | "skipped";
  blocked: boolean;
  passed: number;
  failed: number;
  errors: TestError[];
  durationMs: number;
  testFiles: string[];
  mode: TestGateMode;
}

// ── Gate Runner ─────────────────────────────────────────

/**
 * Run the test gate for a task.
 * Returns structured result indicating if the task should be blocked.
 */
export async function runTestGate(
  store: SqliteStore,
  nodeId: string,
  mode: TestGateMode,
  timeoutMs: number = 30000,
): Promise<TestGateResult> {
  // Off mode = skip entirely
  if (mode === "off") {
    return {
      status: "skipped",
      blocked: false,
      passed: 0,
      failed: 0,
      errors: [],
      durationMs: 0,
      testFiles: [],
      mode,
    };
  }

  // Get node's testFiles
  const node = store.getNodeById(nodeId);
  const testFiles = node?.testFiles ?? [];

  // No test files = skip (backward compatible)
  if (testFiles.length === 0) {
    log.debug("test-gate:skipped", { nodeId, reason: "no testFiles" });
    return {
      status: "skipped",
      blocked: false,
      passed: 0,
      failed: 0,
      errors: [],
      durationMs: 0,
      testFiles: [],
      mode,
    };
  }

  // Run the tests
  log.info("test-gate:running", { nodeId, testFiles, mode, timeoutMs });

  const resultValue = await runTests(testFiles, { timeoutMs });

  const gateResult: TestGateResult = {
    status: resultValue.success ? "passed" : "failed",
    blocked: mode === "strict" && !resultValue.success,
    passed: resultValue.passed,
    failed: resultValue.failed,
    errors: resultValue.errors,
    durationMs: resultValue.durationMs,
    testFiles,
    mode,
  };

  log.info("test-gate:result", {
    nodeId,
    status: gateResult.status,
    blocked: gateResult.blocked,
    passed: gateResult.passed,
    failed: gateResult.failed,
    durationMs: gateResult.durationMs,
  });

  return gateResult;
}
