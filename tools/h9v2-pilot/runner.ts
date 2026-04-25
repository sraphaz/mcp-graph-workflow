/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * H9v2 pilot runner — orchestrates the 3 (+ optional) arms, runs extracted
 * tests, computes metrics + gates, writes docs/BENCHMARK-v11.md.
 *
 * Usage:
 *   npx tsx tools/h9v2-pilot/runner.ts
 *
 * Prereqs:
 *   - workflow-graph/key.txt containing an OpenRouter API key, OR
 *     OPENROUTER_API_KEY env var set.
 *
 * Optional flags (env vars):
 *   PILOT_MAX_USD=2       hard budget cap (default $2)
 *   PILOT_SKIP_STRESS=1   skip Gate 5 (armBStressed)
 *   PILOT_HAIKU=anthropic/claude-haiku-4.5    override Haiku model id
 *   PILOT_SONNET=anthropic/claude-sonnet-4.6  override Sonnet model id
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

import { OpenRouterClient } from "./openrouter-client.js";
import { PLATT_TASK } from "./platt-task.js";
import {
  runMonolithicArm,
  runDecomposedArm,
  type ArmRunResult,
} from "./arms.js";
import { computeArmMetrics, runExtractedTests, type ArmMetrics } from "./metrics.js";
import { evaluateGates, type ArmSet } from "./gates.js";
import { renderReport } from "./report.js";

const HAIKU_MODEL = process.env.PILOT_HAIKU ?? "anthropic/claude-haiku-4.5";
const SONNET_MODEL = process.env.PILOT_SONNET ?? "anthropic/claude-sonnet-4.6";
const MAX_USD = Number(process.env.PILOT_MAX_USD ?? "2");
const SKIP_STRESS = process.env.PILOT_SKIP_STRESS === "1";
const STRESS_BUDGET_TOKENS = 4000;

function toArmMetrics(
  armId: string,
  model: string,
  run: ArmRunResult,
): ArmMetrics {
  const testRun = runExtractedTests(run.files);
  return computeArmMetrics(
    armId,
    model,
    run.promptTokens,
    run.completionTokens,
    run.costUsd,
    run.wallClockMs,
    run.files,
    testRun,
  );
}

async function main(): Promise<void> {
  const client = new OpenRouterClient({ maxUsd: MAX_USD });
  console.log(`H9v2 pilot starting — budget cap $${MAX_USD.toFixed(2)}`);
  console.log(`  Key: ${client.keyDiagnostic}`);
  console.log(`  Haiku model: ${HAIKU_MODEL}`);
  console.log(`  Sonnet model: ${SONNET_MODEL}`);
  console.log(`  Skip stress: ${SKIP_STRESS}`);
  console.log("");

  const designHash = createHash("sha256")
    .update(`${PLATT_TASK.id}|${HAIKU_MODEL}|${SONNET_MODEL}|${PLATT_TASK.subtasks.length}`)
    .digest("hex")
    .slice(0, 12);
  console.log(`  DesignHash: ${designHash}`);
  console.log("");

  // Arm A — Haiku monolithic
  console.log("→ Arm A: Haiku monolithic");
  const armARun = await runMonolithicArm(client, HAIKU_MODEL, PLATT_TASK);
  const armA = toArmMetrics("A", HAIKU_MODEL, armARun);
  console.log(
    `  done: files=${armA.filesExtracted} tests=${armA.testRun.totalTests} parse=${armA.parseRate} pass=${armA.passRate} cost=$${armA.costUsd.toFixed(4)}`,
  );

  // Arm B-v2 — Haiku decomposed + pollination (no budget cap, matches simulation)
  console.log("→ Arm B-v2: Haiku decomposed + context-pollination");
  const armBRun = await runDecomposedArm(client, HAIKU_MODEL, PLATT_TASK, {
    pollinate: true,
  });
  const armB = toArmMetrics("B-v2", HAIKU_MODEL, armBRun);
  console.log(
    `  done: files=${armB.filesExtracted} tests=${armB.testRun.totalTests} parse=${armB.parseRate} pass=${armB.passRate} cost=$${armB.costUsd.toFixed(4)}`,
  );

  // Arm C — Sonnet monolithic
  console.log("→ Arm C: Sonnet monolithic");
  const armCRun = await runMonolithicArm(client, SONNET_MODEL, PLATT_TASK);
  const armC = toArmMetrics("C", SONNET_MODEL, armCRun);
  console.log(
    `  done: files=${armC.filesExtracted} tests=${armC.testRun.totalTests} parse=${armC.parseRate} pass=${armC.passRate} cost=$${armC.costUsd.toFixed(4)}`,
  );

  // Arm B-v2-stressed — same as B-v2 but with budget 4000 tokens (Gate 5)
  let armBStressed: ArmMetrics | undefined;
  if (!SKIP_STRESS) {
    console.log(`→ Arm B-v2-stressed: Haiku decomposed + pollination (budget ${STRESS_BUDGET_TOKENS} tokens)`);
    const stressedRun = await runDecomposedArm(client, HAIKU_MODEL, PLATT_TASK, {
      pollinate: true,
      contextBudgetTokens: STRESS_BUDGET_TOKENS,
    });
    armBStressed = toArmMetrics("B-v2-stressed", HAIKU_MODEL, stressedRun);
    console.log(
      `  done: files=${armBStressed.filesExtracted} tests=${armBStressed.testRun.totalTests} parse=${armBStressed.parseRate} pass=${armBStressed.passRate} cost=$${armBStressed.costUsd.toFixed(4)}`,
    );
  }

  const arms: ArmSet = { armA, armB, armC, armBStressed };
  const gates = evaluateGates(arms);
  const markdown = renderReport(arms, gates, designHash);

  // Auto report lands in the gitignored debug dir — never clobber the curated
  // docs/BENCHMARK-v11.md (which is also local-only / gitignored per the repo's
  // policy on not publishing real benchmark data).
  const reportPath = resolve(process.cwd(), "workflow-graph/h9v2-debug/BENCHMARK-auto.md");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, markdown);

  // Debug: dump raw responses + extracted files for each arm so failures are investigable
  const debugDir = resolve(process.cwd(), "workflow-graph/h9v2-debug");
  mkdirSync(debugDir, { recursive: true });
  const dumpArm = (label: string, run: ArmRunResult, metrics: ArmMetrics): void => {
    writeFileSync(
      resolve(debugDir, `${label}-responses.md`),
      run.rawResponses.map((r, i) => `### Response ${i + 1}\n\n${r}`).join("\n\n---\n\n"),
    );
    writeFileSync(
      resolve(debugDir, `${label}-extracted.json`),
      JSON.stringify(metrics.testRun, null, 2),
    );
    for (const f of run.files) {
      const safeName = f.path.replace(/[/\\]/g, "_");
      writeFileSync(resolve(debugDir, `${label}-file-${safeName}`), f.content);
    }
  };
  dumpArm("A", armARun, armA);
  dumpArm("Bv2", armBRun, armB);
  dumpArm("C", armCRun, armC);

  console.log("");
  console.log(`Report written to ${reportPath}`);
  console.log(`Total spent: $${client.budget.spentUsd.toFixed(4)} / cap $${MAX_USD.toFixed(2)}`);
  console.log(`Overall: ${gates.overallPassed ? "PASS" : "FAIL"}`);
  for (const g of gates.gates) {
    console.log(`  ${g.passed ? "✓" : "✗"} ${g.label}`);
  }
}

main().catch((err) => {
  // Never leak API key from errors
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`pilot failed: ${msg}`);
  process.exit(1);
});
