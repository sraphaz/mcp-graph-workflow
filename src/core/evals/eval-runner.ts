/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset.
 * runEvals — orchestrator that:
 *   1. Pulls goldens from GoldenStore (with optional tool/project filter)
 *   2. Calls dispatch(golden) to produce model output (output + cost + model)
 *   3. Picks a scorer based on golden.scorerKind and computes pass/score
 *   4. Persists each result in EvalRunStore under a shared runId
 *   5. Returns aggregated summary (passRate, totalCostUsd, perRow)
 *
 * The MCP `analyze(eval_run)` mode is a thin wrapper that injects a real
 * dispatch (LlmGateway-backed) and returns this summary verbatim.
 */

import { generateId } from "../utils/id.js";
import type { GoldenStore, GoldenEntry, GoldenFilter } from "../store/golden-store.js";
import type { EvalRunStore } from "../store/eval-run-store.js";
import { exactScorer } from "./scorers/exact.js";
import { regexScorer } from "./scorers/regex.js";
import { acQualityScorer } from "./scorers/ac-quality.js";
import { citationCoverageScorer } from "./scorers/citation-coverage.js";
import type { ScorerResult } from "./scorers/types.js";

export interface DispatchResult {
  output: string;
  modelUsed?: string;
  costUsd?: number;
  latencyMs?: number;
}

export type EvalDispatch = (golden: GoldenEntry) => Promise<DispatchResult>;

export interface RunEvalsOptions {
  goldens: GoldenStore;
  runs: EvalRunStore;
  dispatch: EvalDispatch;
  filter?: GoldenFilter;
  /** Optional run id (default: generated). Allows callers to correlate. */
  runId?: string;
}

export interface PerRowResult {
  goldenId: string;
  tool: string;
  scorerKind: string;
  output: string;
  expected: string;
  score: number;
  passed: boolean;
  details?: string;
  costUsd: number;
  modelUsed?: string;
  latencyMs?: number;
}

export interface RunEvalsSummary {
  runId: string;
  total: number;
  passed: number;
  passRate: number;
  totalCostUsd: number;
  perRow: PerRowResult[];
}

function scoreForGolden(golden: GoldenEntry, output: string): ScorerResult {
  switch (golden.scorerKind) {
    case "exact":
      return exactScorer.score({ output, expected: golden.expected });
    case "regex":
      return regexScorer.score({ output, expected: golden.expected });
    case "ac-quality":
      return acQualityScorer.score({ output });
    case "citation-coverage":
      return citationCoverageScorer.score({
        output,
        expected: golden.expected
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      });
    default:
      return {
        score: 0,
        passed: false,
        details: `unknown scorerKind: ${golden.scorerKind}`,
      };
  }
}

export async function runEvals(opts: RunEvalsOptions): Promise<RunEvalsSummary> {
  const runId = opts.runId ?? generateId("evalrun");
  const goldenList = opts.goldens.list(opts.filter ?? {});

  const perRow: PerRowResult[] = [];
  let passed = 0;
  let totalCostUsd = 0;

  for (const golden of goldenList) {
    const dispatched = await opts.dispatch(golden);
    const cost = dispatched.costUsd ?? 0;
    totalCostUsd += cost;

    const result = scoreForGolden(golden, dispatched.output);
    if (result.passed) passed++;

    opts.runs.record({
      runId,
      goldenId: golden.id,
      score: result.score,
      passed: result.passed,
      latencyMs: dispatched.latencyMs,
      modelUsed: dispatched.modelUsed,
      costUsd: cost,
    });

    perRow.push({
      goldenId: golden.id,
      tool: golden.tool,
      scorerKind: golden.scorerKind,
      output: dispatched.output,
      expected: golden.expected,
      score: result.score,
      passed: result.passed,
      details: result.details,
      costUsd: cost,
      modelUsed: dispatched.modelUsed,
      latencyMs: dispatched.latencyMs,
    });
  }

  return {
    runId,
    total: goldenList.length,
    passed,
    passRate: goldenList.length > 0 ? passed / goldenList.length : 0,
    totalCostUsd,
    perRow,
  };
}
