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
 * Test Runner — Vitest JSON Reporter Integration
 *
 * Executes Vitest test files as child_process and parses JSON output.
 * Provides closed-loop feedback for the agent TDD cycle.
 *
 * Based on: Cybernetics (Wiener, 1948) — Closed-Loop Feedback
 * and DORA Metrics (Accelerate, 2018) — Shift-Left testing.
 */

import { execFile } from "node:child_process";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "test-runner.ts" });

// ── Types ───────────────────────────────────────────────

export interface TestRunOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Working directory (default: process.cwd()) */
  cwd?: string;
}

export interface TestError {
  testName: string;
  message: string;
  stack?: string;
}

export interface TestRunResult {
  success: boolean;
  passed: number;
  failed: number;
  errors: TestError[];
  durationMs: number;
  timedOut: boolean;
  rawOutput?: string;
}

// ── Vitest JSON output types (subset) ───────────────────

interface VitestJsonResult {
  numPassedTests?: number;
  numFailedTests?: number;
  success?: boolean;
  testResults?: Array<{
    assertionResults?: Array<{
      fullName?: string;
      status?: string;
      failureMessages?: string[];
    }>;
  }>;
}

// ── Runner ──────────────────────────────────────────────

/**
 * Run Vitest on specific test files and return structured results.
 * Uses `--reporter=json` for machine-parseable output.
 */
export async function runTests(
  testFiles: string[],
  options?: TestRunOptions,
): Promise<TestRunResult> {
  const timeoutMs = options?.timeoutMs ?? 30000;
  const cwd = options?.cwd ?? process.cwd();
  const startTime = Date.now();

  if (testFiles.length === 0) {
    return {
      success: true,
      passed: 0,
      failed: 0,
      errors: [],
      durationMs: 0,
      timedOut: false,
    };
  }

  return new Promise<TestRunResult>((resolve) => {
    const args = ["vitest", "run", "--reporter=json", ...testFiles];

    log.debug("test-runner:start", { testFiles, timeoutMs });

    const child = execFile("npx", args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for JSON output
      env: { ...process.env, FORCE_COLOR: "0" },
    }, (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;

      // Check for timeout
      if (error && "killed" in error && error.killed) {
        log.warn("test-runner:timeout", { testFiles, timeoutMs, durationMs });
        resolve({
          success: false,
          passed: 0,
          failed: 0,
          errors: [{ testName: "timeout", message: `Test execution timed out after ${timeoutMs}ms` }],
          durationMs,
          timedOut: true,
        });
        return;
      }

      // Try to parse JSON from stdout
      const jsonResult = parseVitestJson(stdout);

      if (jsonResult) {
        const errors = extractErrors(jsonResult);
        const passed = jsonResult.numPassedTests ?? 0;
        const failed = jsonResult.numFailedTests ?? 0;

        log.debug("test-runner:done", { passed, failed, durationMs });

        resolve({
          success: failed === 0 && (jsonResult.success ?? true),
          passed,
          failed,
          errors,
          durationMs,
          timedOut: false,
        });
      } else {
        // JSON parse failed — treat as error
        const errMsg = stderr?.trim() || error?.message || "Unknown test runner error";

        log.warn("test-runner:parse-failed", { errMsg: errMsg.slice(0, 200), durationMs });

        resolve({
          success: false,
          passed: 0,
          failed: 1,
          errors: [{ testName: "runner", message: errMsg.slice(0, 500) }],
          durationMs,
          timedOut: false,
          rawOutput: stdout?.slice(0, 1000),
        });
      }
    });

    // Safety: ensure child doesn't leak on unexpected conditions
    child.on("error", (err) => {
      const durationMs = Date.now() - startTime;
      log.warn("test-runner:child-error", { error: err.message });
      resolve({
        success: false,
        passed: 0,
        failed: 0,
        errors: [{ testName: "spawn", message: err.message }],
        durationMs,
        timedOut: false,
      });
    });
  });
}

/**
 * Parse Vitest JSON output from stdout.
 * The JSON may be mixed with other output — find the JSON object.
 */
function parseVitestJson(stdout: string): VitestJsonResult | null {
  if (!stdout) return null;

  // Try direct parse first
  try {
    return JSON.parse(stdout) as VitestJsonResult;
  } catch {
    // JSON might be mixed with other output — find the last { ... } block
  }

  // Find the last JSON object in the output
  const lastBrace = stdout.lastIndexOf("}");
  if (lastBrace === -1) return null;

  // Walk backwards to find matching opening brace
  let depth = 0;
  let start = -1;
  for (let i = lastBrace; i >= 0; i--) {
    if (stdout[i] === "}") depth++;
    if (stdout[i] === "{") depth--;
    if (depth === 0) {
      start = i;
      break;
    }
  }

  if (start === -1) return null;

  try {
    return JSON.parse(stdout.slice(start, lastBrace + 1)) as VitestJsonResult;
  } catch {
    return null;
  }
}

/**
 * Extract structured errors from Vitest JSON result.
 */
function extractErrors(result: VitestJsonResult): TestError[] {
  const errors: TestError[] = [];

  for (const suite of result.testResults ?? []) {
    for (const test of suite.assertionResults ?? []) {
      if (test.status === "failed" && test.failureMessages) {
        errors.push({
          testName: test.fullName ?? "unknown",
          message: test.failureMessages[0]?.slice(0, 500) ?? "Test failed",
          stack: test.failureMessages[0]?.slice(0, 1000),
        });
      }
    }
  }

  return errors;
}
