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
 * Cost Tracker — per-model pricing database and cost estimation.
 * Inspired by hermes-agent cost-aware operations.
 * Pricing as of 2025-Q2 (USD per 1M tokens).
 */

import { logger } from "../utils/logger.js";

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export interface CostBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalUsd: number;
}

// ── Pricing database (USD per 1M tokens) ──

export const MODEL_PRICING = new Map<string, ModelPricing>([
  // Anthropic
  ["claude-opus-4", { inputPer1M: 15.0, outputPer1M: 75.0 }],
  ["claude-sonnet-4", { inputPer1M: 3.0, outputPer1M: 15.0 }],
  ["claude-haiku-4", { inputPer1M: 0.80, outputPer1M: 4.0 }],
  ["claude-3-5-sonnet", { inputPer1M: 3.0, outputPer1M: 15.0 }],
  ["claude-3-5-haiku", { inputPer1M: 0.80, outputPer1M: 4.0 }],
  ["claude-3-opus", { inputPer1M: 15.0, outputPer1M: 75.0 }],
  // OpenAI
  ["gpt-4o", { inputPer1M: 2.50, outputPer1M: 10.0 }],
  ["gpt-4o-mini", { inputPer1M: 0.15, outputPer1M: 0.60 }],
  ["gpt-4-turbo", { inputPer1M: 10.0, outputPer1M: 30.0 }],
  ["o1", { inputPer1M: 15.0, outputPer1M: 60.0 }],
  ["o1-mini", { inputPer1M: 3.0, outputPer1M: 12.0 }],
  // Google
  ["gemini-2.0-flash", { inputPer1M: 0.075, outputPer1M: 0.30 }],
  ["gemini-1.5-pro", { inputPer1M: 1.25, outputPer1M: 5.0 }],
]);

/**
 * Look up pricing for a model. Supports exact match and prefix matching
 * (e.g., "claude-sonnet-4-20250514" matches "claude-sonnet-4").
 */
export function getModelPricing(model: string): ModelPricing | undefined {
  // Exact match first
  const exact = MODEL_PRICING.get(model);
  if (exact) return exact;

  // Prefix match: find the longest key that the model starts with
  let bestMatch: ModelPricing | undefined;
  let bestLength = 0;
  for (const [key, pricing] of MODEL_PRICING) {
    if (model.startsWith(key) && key.length > bestLength) {
      bestMatch = pricing;
      bestLength = key.length;
    }
  }

  return bestMatch;
}

/**
 * Calculate cost for a given model and token counts.
 * Returns zero for unknown models (with a warning logged).
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): CostBreakdown {
  const pricing = getModelPricing(model);

  if (!pricing) {
    logger.warn("cost-tracker:unknown_model", { model });
    return { model, inputTokens, outputTokens, inputCostUsd: 0, outputCostUsd: 0, totalUsd: 0 };
  }

  const inputCostUsd = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.outputPer1M;

  return {
    model,
    inputTokens,
    outputTokens,
    inputCostUsd,
    outputCostUsd,
    totalUsd: inputCostUsd + outputCostUsd,
  };
}
