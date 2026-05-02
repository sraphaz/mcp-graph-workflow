/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.B3 — Cost auto-fallback to Haiku.
 * Pure decision module + hook handler. When cumulative spend exceeds
 * COST_FALLBACK_THRESHOLD (default 0.8) of capUsdPerRun, mutate
 * payload.modelHint='haiku' and emit cost:fallback-engaged.
 *
 * Toggle: env MCP_GRAPH_COST_FALLBACK=off disables the handler.
 */

export const COST_FALLBACK_THRESHOLD = 0.8;
export const FALLBACK_MODEL = "haiku";

export interface CostFallbackInput {
  totalUsd: number;
  capUsdPerRun: number | undefined;
  threshold?: number;
}

export interface CostFallbackDecision {
  engage: boolean;
  ratio: number;
  reason: "no_cap" | "below_threshold" | "threshold_exceeded";
}

/** Pure: decide if fallback should engage given current spend + cap. */
export function shouldEngageCostFallback(input: CostFallbackInput): CostFallbackDecision {
  const threshold = input.threshold ?? COST_FALLBACK_THRESHOLD;

  if (input.capUsdPerRun === undefined || !Number.isFinite(input.capUsdPerRun) || input.capUsdPerRun <= 0) {
    return { engage: false, ratio: 0, reason: "no_cap" };
  }
  const ratio = input.totalUsd / input.capUsdPerRun;
  if (ratio > threshold) {
    return { engage: true, ratio, reason: "threshold_exceeded" };
  }
  return { engage: false, ratio, reason: "below_threshold" };
}

/** isCostFallbackDisabled — auto-generated description placeholder. */
export function isCostFallbackDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_COST_FALLBACK === "off";
}

export interface ApplyFallbackResult {
  engaged: boolean;
  originalModel: string | undefined;
  fallbackModel: string | undefined;
  ratio: number;
}

/**
 * Apply fallback to a hook payload (mutates payload.modelHint).
 * Returns engagement details for emit/log purposes.
 */
export function applyCostFallback(
  payload: { modelHint?: string },
  decision: CostFallbackDecision,
): ApplyFallbackResult {
  if (!decision.engage) {
    return { engaged: false, originalModel: payload.modelHint, fallbackModel: undefined, ratio: decision.ratio };
  }
  const originalModel = payload.modelHint;
  payload.modelHint = FALLBACK_MODEL;
  return { engaged: true, originalModel, fallbackModel: FALLBACK_MODEL, ratio: decision.ratio };
}
