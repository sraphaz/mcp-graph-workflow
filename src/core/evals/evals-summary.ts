/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset.
 * evals-summary — read-only aggregations consumed by the dashboard EvalsTab
 * and the GET /api/evals route. Pure SQL over eval_run + eval_golden.
 */

import type Database from "better-sqlite3";

export interface PassRateTrendPoint {
  /** ISO date bucket (YYYY-MM-DD). */
  date: string;
  total: number;
  passed: number;
  passRate: number;
  totalCostUsd: number;
}

export interface TopFailingGolden {
  goldenId: string;
  tool: string;
  scorerKind: string;
  input: string;
  expected: string;
  failures: number;
  attempts: number;
  failureRate: number;
}

export interface EvalsSummary {
  totalRuns: number;
  totalGoldens: number;
  passRate: number;
  totalCostUsd: number;
  trend: PassRateTrendPoint[];
  topFailing: TopFailingGolden[];
}

export interface EvalsSummaryOptions {
  /** Limit trend window in days. Default 30. */
  trendDays?: number;
  /** Top-N failing goldens. Default 10. */
  topFailingLimit?: number;
}

interface TrendRow {
  date: string;
  total: number;
  passed: number;
  cost: number;
}

interface FailingRow {
  golden_id: string;
  tool: string;
  scorer_kind: string;
  input: string;
  expected: string;
  failures: number;
  attempts: number;
}

export function computeEvalsSummary(
  db: Database.Database,
  opts: EvalsSummaryOptions = {},
): EvalsSummary {
  const trendDays = opts.trendDays ?? 30;
  const topFailingLimit = opts.topFailingLimit ?? 10;

  const totals = db
    .prepare(
      `SELECT
         (SELECT COUNT(DISTINCT run_id) FROM eval_run)              AS total_runs,
         (SELECT COUNT(*)               FROM eval_golden)           AS total_goldens,
         COALESCE((SELECT COUNT(*)      FROM eval_run), 0)          AS total_rows,
         COALESCE((SELECT SUM(passed)   FROM eval_run), 0)          AS passed_rows,
         COALESCE((SELECT SUM(cost_usd) FROM eval_run), 0)          AS cost`,
    )
    .get() as {
    total_runs: number;
    total_goldens: number;
    total_rows: number;
    passed_rows: number;
    cost: number;
  };

  const trendRows = db
    .prepare(
      `SELECT
         substr(created_at, 1, 10)         AS date,
         COUNT(*)                          AS total,
         COALESCE(SUM(passed), 0)          AS passed,
         COALESCE(SUM(cost_usd), 0)        AS cost
       FROM eval_run
       WHERE created_at >= date('now', ?)
       GROUP BY substr(created_at, 1, 10)
       ORDER BY date ASC`,
    )
    .all(`-${Math.max(0, trendDays)} days`) as TrendRow[];

  const trend: PassRateTrendPoint[] = trendRows.map((r) => ({
    date: r.date,
    total: r.total,
    passed: r.passed,
    passRate: r.total > 0 ? r.passed / r.total : 0,
    totalCostUsd: r.cost,
  }));

  const topFailingRows = db
    .prepare(
      `SELECT
         g.id           AS golden_id,
         g.tool         AS tool,
         g.scorer_kind  AS scorer_kind,
         g.input        AS input,
         g.expected     AS expected,
         SUM(CASE WHEN r.passed = 0 THEN 1 ELSE 0 END) AS failures,
         COUNT(r.id)                                   AS attempts
       FROM eval_run r
       JOIN eval_golden g ON g.id = r.golden_id
       GROUP BY g.id
       HAVING failures > 0
       ORDER BY failures DESC, attempts DESC
       LIMIT ?`,
    )
    .all(topFailingLimit) as FailingRow[];

  const topFailing: TopFailingGolden[] = topFailingRows.map((r) => ({
    goldenId: r.golden_id,
    tool: r.tool,
    scorerKind: r.scorer_kind,
    input: r.input,
    expected: r.expected,
    failures: r.failures,
    attempts: r.attempts,
    failureRate: r.attempts > 0 ? r.failures / r.attempts : 0,
  }));

  return {
    totalRuns: totals.total_runs,
    totalGoldens: totals.total_goldens,
    passRate: totals.total_rows > 0 ? totals.passed_rows / totals.total_rows : 0,
    totalCostUsd: totals.cost,
    trend,
    topFailing,
  };
}
