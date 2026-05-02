/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-11.T03 — Cache-aware pricing.
 * Anthropic prompt cache pricing (per their docs):
 *   - cache writes (cache_creation_input_tokens) cost 1.25× the input rate
 *   - cache reads  (cache_read_input_tokens)     cost 0.10× the input rate
 *
 * computeCachedCost splits inputTokens into plain / cached / created buckets
 * and applies the right rate to each.
 */

export const CACHE_READ_MULTIPLIER = 0.1;
export const CACHE_WRITE_MULTIPLIER = 1.25;

export interface PricingRates {
  /** Plain input rate (USD per token). */
  inputRate: number;
  /** Output rate (USD per token). */
  outputRate: number;
}

export interface CostInputs {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheCreationTokens?: number;
}

export interface CostBreakdown {
  plainInputTokens: number;
  cachedTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  plainCostUsd: number;
  cachedCostUsd: number;
  creationCostUsd: number;
  outputCostUsd: number;
  totalUsd: number;
}

function safe(n: number | undefined): number {
  return Number.isFinite(n) && (n ?? 0) > 0 ? (n as number) : 0;
}

/** computeCachedCost — auto-generated description placeholder. */
export function computeCachedCost(
  inputs: CostInputs,
  rates: PricingRates,
): CostBreakdown {
  const cached = safe(inputs.cachedTokens);
  const created = safe(inputs.cacheCreationTokens);
  const totalInput = Math.max(0, inputs.inputTokens);
  const plain = Math.max(0, totalInput - cached - created);

  const plainCostUsd = plain * rates.inputRate;
  const cachedCostUsd = cached * rates.inputRate * CACHE_READ_MULTIPLIER;
  const creationCostUsd = created * rates.inputRate * CACHE_WRITE_MULTIPLIER;
  const outputCostUsd = Math.max(0, inputs.outputTokens) * rates.outputRate;

  return {
    plainInputTokens: plain,
    cachedTokens: cached,
    cacheCreationTokens: created,
    outputTokens: Math.max(0, inputs.outputTokens),
    plainCostUsd,
    cachedCostUsd,
    creationCostUsd,
    outputCostUsd,
    totalUsd: plainCostUsd + cachedCostUsd + creationCostUsd + outputCostUsd,
  };
}
