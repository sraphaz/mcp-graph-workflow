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
import { logger } from "../utils/logger.js";

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
    logger.debug("test-gate:skipped", { nodeId, reason: "no testFiles" });
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
  logger.info("test-gate:running", { nodeId, testFiles, mode, timeoutMs });

  const result = await runTests(testFiles, { timeoutMs });

  const gateResult: TestGateResult = {
    status: result.success ? "passed" : "failed",
    blocked: mode === "strict" && !result.success,
    passed: result.passed,
    failed: result.failed,
    errors: result.errors,
    durationMs: result.durationMs,
    testFiles,
    mode,
  };

  logger.info("test-gate:result", {
    nodeId,
    status: gateResult.status,
    blocked: gateResult.blocked,
    passed: gateResult.passed,
    failed: gateResult.failed,
    durationMs: gateResult.durationMs,
  });

  return gateResult;
}
