/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset.
 * Empirical modelHint feedback loop — picks the model that historically
 * performs best on a given tool, based on the last N eval_run rows.
 *
 * Wired into start_task's modelHint computation: when this returns a
 * recommendation, it overrides the heuristic (xpSize/AC/depth) score.
 */

import type { EvalRunStore, EvalRunEntry } from "../store/eval-run-store.js";

export interface EmpiricalModelHintOptions {
  tool: string;
  /** Last N rows to consider. Default 50 (matches AC5 of the PRD). */
  limit?: number;
  /** Minimum samples per model required to consider it. Default 3. */
  minSamples?: number;
}

export interface EmpiricalModelHint {
  recommended: string;
  passRate: number;
  avgCostUsd: number;
  basedOn: number;
  perModel: Array<{
    model: string;
    samples: number;
    passRate: number;
    avgCostUsd: number;
  }>;
}

interface ModelAgg {
  model: string;
  samples: number;
  passed: number;
  cost: number;
}

export function computeEmpiricalModelHint(
  runs: EvalRunStore,
  opts: EmpiricalModelHintOptions,
): EmpiricalModelHint | null {
  const limit = opts.limit ?? 50;
  const minSamples = opts.minSamples ?? 3;

  const rows: EvalRunEntry[] = runs.recentByTool(opts.tool, limit);
  if (rows.length === 0) return null;

  const byModel = new Map<string, ModelAgg>();
  for (const r of rows) {
    if (!r.modelUsed) continue;
    const agg = byModel.get(r.modelUsed) ?? {
      model: r.modelUsed,
      samples: 0,
      passed: 0,
      cost: 0,
    };
    agg.samples++;
    if (r.passed) agg.passed++;
    agg.cost += r.costUsd;
    byModel.set(r.modelUsed, agg);
  }

  const eligible = [...byModel.values()].filter((m) => m.samples >= minSamples);
  if (eligible.length === 0) return null;

  // Highest pass-rate; break ties by cheaper avg cost.
  eligible.sort((a, b) => {
    const rateA = a.passed / a.samples;
    const rateB = b.passed / b.samples;
    if (rateA !== rateB) return rateB - rateA;
    return a.cost / a.samples - b.cost / b.samples;
  });

  const winner = eligible[0];
  if (winner === undefined) return null;
  return {
    recommended: winner.model,
    passRate: winner.passed / winner.samples,
    avgCostUsd: winner.cost / winner.samples,
    basedOn: rows.filter((r) => r.modelUsed).length,
    perModel: eligible.map((m) => ({
      model: m.model,
      samples: m.samples,
      passRate: m.passed / m.samples,
      avgCostUsd: m.cost / m.samples,
    })),
  };
}
