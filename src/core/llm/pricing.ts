/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — pricing calculator.
 * USD = (input_tokens / 1e6) * inputPerMtok
 *     + (cached_input_tokens / 1e6) * cachedInputPerMtok? (subtracted from input)
 *     + (output_tokens / 1e6) * outputPerMtok
 */

import type { LlmUsage, ModelSpec } from "./types.js";

const TOKENS_PER_MTOK = 1_000_000;

export function calcCost(usage: LlmUsage, spec: ModelSpec): number {
  const cacheRead = usage.cachedInputTokens ?? 0;
  const cacheWrite = usage.cacheCreationInputTokens ?? 0;
  const plainInput = Math.max(0, usage.inputTokens - cacheRead - cacheWrite);

  const readRate = spec.pricing.cachedInputPerMtok ?? spec.pricing.inputPerMtok;
  const writeRate = spec.pricing.cacheCreationInputPerMtok ?? spec.pricing.inputPerMtok;

  const inputCost = (plainInput / TOKENS_PER_MTOK) * spec.pricing.inputPerMtok;
  const cacheReadCost = (cacheRead / TOKENS_PER_MTOK) * readRate;
  const cacheWriteCost = (cacheWrite / TOKENS_PER_MTOK) * writeRate;
  const outputCost = (usage.outputTokens / TOKENS_PER_MTOK) * spec.pricing.outputPerMtok;

  return inputCost + cacheReadCost + cacheWriteCost + outputCost;
}
