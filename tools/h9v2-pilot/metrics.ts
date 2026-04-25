/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Metrics computation for the H9v2 pilot: parse rate, pass rate, per-arm summary.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ExtractedFile } from "./extract.js";

export interface TestRunOutcome {
  totalTests: number;
  passed: number;
  failed: number;
  parsed: boolean;
  /** Full stderr+stdout for debugging (truncated to 2000 chars). */
  log: string;
}

/**
 * Write files to a temp dir and run vitest on any .test.ts among them.
 * Returns parse+pass counts. Never throws — parse failures mark parsed=false.
 */
export function runExtractedTests(files: ExtractedFile[]): TestRunOutcome {
  if (files.length === 0) {
    return { totalTests: 0, passed: 0, failed: 0, parsed: false, log: "no files extracted" };
  }

  const dir = mkdtempSync(join(tmpdir(), "h9v2-arm-"));
  for (const f of files) {
    writeFileSync(join(dir, f.path), f.content);
  }

  // Write a minimal package.json pointing at the repo's vitest
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "h9v2-arm", type: "module" }, null, 2),
  );

  // Write a minimal tsconfig so vitest's TS transform can parse
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
      null,
      2,
    ),
  );

  const result = spawnSync(
    "npx",
    ["vitest", "run", "--reporter=json", "--no-coverage"],
    { cwd: dir, encoding: "utf-8", timeout: 60_000 },
  );

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const log = (stdout + "\n" + stderr).slice(-2000);

  let totalTests = 0;
  let passed = 0;
  let failed = 0;
  let parsed = false;

  // Try to find JSON output
  const jsonStart = stdout.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const json = JSON.parse(stdout.slice(jsonStart));
      totalTests = json.numTotalTests ?? 0;
      passed = json.numPassedTests ?? 0;
      failed = json.numFailedTests ?? 0;
      parsed = !stderr.match(/Parse error|SyntaxError|TransformError/i) && totalTests > 0;
    } catch {
      // fall through — parse failure
    }
  }

  // Heuristic: if stdout contains "passed" and "failed" markers, infer parsed=true even without JSON
  if (!parsed && /\d+ passed|\d+ failed/.test(stdout + stderr)) {
    parsed = !stderr.match(/SyntaxError|TransformError|ParseError/i);
  }

  return { totalTests, passed, failed, parsed, log };
}

export interface ArmMetrics {
  armId: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  wallClockMs: number;
  filesExtracted: number;
  testRun: TestRunOutcome;
  /** parseRate = passed / totalTests (or 0 if parse failed) */
  parseRate: number;
  passRate: number;
}

export function computeArmMetrics(
  armId: string,
  modelUsed: string,
  promptTokens: number,
  completionTokens: number,
  costUsd: number,
  wallClockMs: number,
  files: ExtractedFile[],
  testRun: TestRunOutcome,
): ArmMetrics {
  const parseRate = testRun.parsed && testRun.totalTests > 0 ? 1 : 0;
  const passRate =
    testRun.totalTests > 0 ? testRun.passed / testRun.totalTests : 0;

  return {
    armId,
    modelUsed,
    promptTokens,
    completionTokens,
    costUsd,
    wallClockMs,
    filesExtracted: files.length,
    testRun,
    parseRate,
    passRate,
  };
}
