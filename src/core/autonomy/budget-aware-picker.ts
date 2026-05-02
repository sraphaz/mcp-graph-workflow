/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.B4 — Budget-aware task selection.
 * AutopilotScheduler picker que prefere XS/S quando budget remaining < 20%.
 * Pure module: pickBudgetAwareTask(candidates, budget) → task | null.
 */

export const LOW_BUDGET_THRESHOLD = 0.2;
export const SMALL_SIZES = new Set(["XS", "S"]);

export type XpSize = "XS" | "S" | "M" | "L" | "XL";

export interface CandidateTask {
  id: string;
  xpSize?: XpSize;
  priority: number;
  depth?: number;
}

export interface BudgetState {
  capUsdPerRun: number | undefined;
  totalUsd: number;
}

/** isBudgetAwareDisabled — auto-generated description placeholder. */
export function isBudgetAwareDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_BUDGET_AWARE === "off";
}

/** isBudgetLow — auto-generated description placeholder. */
export function isBudgetLow(budget: BudgetState, threshold = LOW_BUDGET_THRESHOLD): boolean {
  if (
    budget.capUsdPerRun === undefined ||
    !Number.isFinite(budget.capUsdPerRun) ||
    budget.capUsdPerRun <= 0
  ) {
    return false;
  }
  const spentRatio = budget.totalUsd / budget.capUsdPerRun;
  return spentRatio > 1 - threshold;
}

/**
 * Pick the next candidate, biased toward small tasks when budget is low.
 * Sort: priority ASC (1 highest), depth ASC, id ASC for stability.
 * Falls back to full list when no XS/S available even though budget is low.
 */
export function pickBudgetAwareTask(
  candidates: CandidateTask[],
  budget: BudgetState,
): CandidateTask | null {
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const da = a.depth ?? 0;
    const db = b.depth ?? 0;
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });

  if (!isBudgetLow(budget)) {
    return sorted[0];
  }

  const small = sorted.filter((c) => c.xpSize !== undefined && SMALL_SIZES.has(c.xpSize));
  if (small.length > 0) return small[0];

  return sorted[0];
}
