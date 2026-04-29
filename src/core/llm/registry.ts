/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — model registry.
 * Maps model id (`<provider>/<model>`) to ModelSpec with tier, context window, pricing.
 * Pricing seed values are static (ADR-llm-02); refresh via TODO sync-openrouter-prices script (out-of-scope v12).
 */

import { LlmModelUnknown } from "./errors.js";
import type { ModelSpec, ModelTier } from "./types.js";

export interface RegistryListOptions {
  /** When false, models with tier='expensive' are filtered out (default: true). */
  allowExpensive?: boolean;
  /** Restrict to a specific tier. */
  tier?: ModelTier;
}

export class ModelRegistry {
  private readonly byId: Map<string, ModelSpec>;

  constructor(seed: readonly ModelSpec[]) {
    this.byId = new Map(seed.map((m) => [m.id, m]));
  }

  lookupModel(id: string): ModelSpec {
    const spec = this.byId.get(id);
    if (!spec) {
      throw new LlmModelUnknown(id);
    }
    return spec;
  }

  list(opts: RegistryListOptions = {}): ModelSpec[] {
    const { allowExpensive = true, tier } = opts;
    const all = Array.from(this.byId.values());
    return all.filter((m) => {
      if (!allowExpensive && m.tier === "expensive") return false;
      if (tier && m.tier !== tier) return false;
      return true;
    });
  }
}

/**
 * Default seed of widely-used models. Pricing is per-million-tokens (USD).
 * Tier policy:
 *  - cheap:     allowed by default (<$1/M-tok input typical)
 *  - mid:       allowed by default
 *  - expensive: blocked unless allowExpensive=true (claude-sonnet/opus, gpt-4o/5)
 */
export const DEFAULT_MODEL_SEED: readonly ModelSpec[] = [
  // Anthropic
  {
    id: "anthropic/claude-haiku-4-5",
    provider: "anthropic",
    tier: "cheap",
    contextWindow: 200_000,
    pricing: { inputPerMtok: 1.0, outputPerMtok: 5.0, cachedInputPerMtok: 0.1 },
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    provider: "anthropic",
    tier: "expensive",
    contextWindow: 200_000,
    pricing: { inputPerMtok: 3.0, outputPerMtok: 15.0, cachedInputPerMtok: 0.3 },
  },
  {
    id: "anthropic/claude-opus-4-7",
    provider: "anthropic",
    tier: "expensive",
    contextWindow: 200_000,
    pricing: { inputPerMtok: 15.0, outputPerMtok: 75.0, cachedInputPerMtok: 1.5 },
  },
  // OpenAI
  {
    id: "openai/gpt-4o-mini",
    provider: "openai",
    tier: "cheap",
    contextWindow: 128_000,
    pricing: { inputPerMtok: 0.15, outputPerMtok: 0.6 },
  },
  {
    id: "openai/gpt-4o",
    provider: "openai",
    tier: "expensive",
    contextWindow: 128_000,
    pricing: { inputPerMtok: 2.5, outputPerMtok: 10.0 },
  },
  // OpenRouter (auto / cheap pool)
  {
    id: "openrouter/auto",
    provider: "openrouter",
    tier: "mid",
    contextWindow: 128_000,
    pricing: { inputPerMtok: 1.0, outputPerMtok: 3.0 },
  },
  // Copilot (provided as fixed pool — pricing N/A for end-users)
  {
    id: "copilot/gpt-4.1",
    provider: "copilot",
    tier: "mid",
    contextWindow: 128_000,
    pricing: { inputPerMtok: 0, outputPerMtok: 0 },
  },
  // Ollama (local — zero cost)
  {
    id: "ollama/llama3.2",
    provider: "ollama",
    tier: "cheap",
    contextWindow: 128_000,
    pricing: { inputPerMtok: 0, outputPerMtok: 0 },
  },
];

export const defaultRegistry = new ModelRegistry(DEFAULT_MODEL_SEED);
