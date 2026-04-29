/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { ModelRegistry, defaultRegistry } from "../core/llm/registry.js";
import { calcCost } from "../core/llm/pricing.js";
import { LlmModelUnknown } from "../core/llm/errors.js";
import type { ModelSpec } from "../core/llm/types.js";

describe("core/llm/registry — model lookup + tier filtering", () => {
  it("lookupModel('anthropic/claude-haiku-4-5') returns ModelSpec with tier='cheap'", () => {
    const spec = defaultRegistry.lookupModel("anthropic/claude-haiku-4-5");
    expect(spec.id).toBe("anthropic/claude-haiku-4-5");
    expect(spec.tier).toBe("cheap");
    expect(spec.provider).toBe("anthropic");
    expect(spec.contextWindow).toBeGreaterThanOrEqual(100_000);
  });

  it("lookupModel for a registered Sonnet returns tier='expensive'", () => {
    const spec = defaultRegistry.lookupModel("anthropic/claude-sonnet-4-6");
    expect(spec.tier).toBe("expensive");
    expect(spec.provider).toBe("anthropic");
  });

  it("lookupModel for openai/gpt-4o-mini returns tier='cheap'", () => {
    const spec = defaultRegistry.lookupModel("openai/gpt-4o-mini");
    expect(spec.tier).toBe("cheap");
    expect(spec.provider).toBe("openai");
  });

  it("lookupModel('unknown/foo') throws LlmModelUnknown with the requested id", () => {
    expect(() => defaultRegistry.lookupModel("unknown/foo")).toThrowError(LlmModelUnknown);
    try {
      defaultRegistry.lookupModel("unknown/foo");
    } catch (err) {
      expect(err).toBeInstanceOf(LlmModelUnknown);
      expect((err as LlmModelUnknown).modelId).toBe("unknown/foo");
    }
  });

  it("list({allowExpensive:false}) excludes models with tier='expensive'", () => {
    const cheap = defaultRegistry.list({ allowExpensive: false });
    expect(cheap.length).toBeGreaterThan(0);
    expect(cheap.every((m: ModelSpec) => m.tier !== "expensive")).toBe(true);
  });

  it("list({allowExpensive:true}) includes expensive models", () => {
    const all = defaultRegistry.list({ allowExpensive: true });
    expect(all.some((m: ModelSpec) => m.tier === "expensive")).toBe(true);
  });

  it("list({tier:'cheap'}) returns only cheap models", () => {
    const cheap = defaultRegistry.list({ tier: "cheap" });
    expect(cheap.every((m: ModelSpec) => m.tier === "cheap")).toBe(true);
  });

  it("ModelRegistry can be instantiated with a custom seed", () => {
    const custom = new ModelRegistry([
      {
        id: "x/y",
        provider: "openrouter",
        tier: "mid",
        contextWindow: 100_000,
        pricing: { inputPerMtok: 1, outputPerMtok: 2 },
      },
    ]);
    expect(custom.lookupModel("x/y").tier).toBe("mid");
    expect(() => custom.lookupModel("anthropic/claude-haiku-4-5")).toThrowError(LlmModelUnknown);
  });
});

describe("core/llm/pricing — calcCost in USD", () => {
  const haikuSpec: ModelSpec = {
    id: "anthropic/claude-haiku-4-5",
    provider: "anthropic",
    tier: "cheap",
    contextWindow: 200_000,
    pricing: { inputPerMtok: 1.0, outputPerMtok: 5.0 },
  };

  it("calcCost(1000 in, 500 out) returns positive USD with 6 decimals", () => {
    const usd = calcCost({ inputTokens: 1000, outputTokens: 500 }, haikuSpec);
    // 1000/1e6 * 1.0 + 500/1e6 * 5.0 = 0.001 + 0.0025 = 0.0035
    expect(usd).toBeCloseTo(0.0035, 6);
    expect(usd).toBeGreaterThan(0);
  });

  it("calcCost with cachedInputTokens applies cached pricing when available", () => {
    const spec: ModelSpec = {
      ...haikuSpec,
      pricing: { inputPerMtok: 1.0, outputPerMtok: 5.0, cachedInputPerMtok: 0.1 },
    };
    const usd = calcCost(
      { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 800 },
      spec,
    );
    // non-cached input: 200/1e6 * 1.0 = 0.0002
    // cached:           800/1e6 * 0.1 = 0.00008
    // output:           500/1e6 * 5.0 = 0.0025
    expect(usd).toBeCloseTo(0.0002 + 0.00008 + 0.0025, 8);
  });

  it("calcCost golden: Haiku 1k/1k = 0.006 USD", () => {
    expect(calcCost({ inputTokens: 1000, outputTokens: 1000 }, haikuSpec)).toBeCloseTo(0.006, 8);
  });

  it("calcCost golden: Sonnet (3/15) 1k/1k = 0.018 USD", () => {
    const sonnetSpec: ModelSpec = {
      id: "anthropic/claude-sonnet-4-6",
      provider: "anthropic",
      tier: "expensive",
      contextWindow: 200_000,
      pricing: { inputPerMtok: 3.0, outputPerMtok: 15.0 },
    };
    expect(calcCost({ inputTokens: 1000, outputTokens: 1000 }, sonnetSpec)).toBeCloseTo(0.018, 8);
  });

  it("calcCost golden: gpt-4o-mini (0.15/0.6) 1k/1k = 0.00075 USD", () => {
    const miniSpec: ModelSpec = {
      id: "openai/gpt-4o-mini",
      provider: "openai",
      tier: "cheap",
      contextWindow: 128_000,
      pricing: { inputPerMtok: 0.15, outputPerMtok: 0.6 },
    };
    expect(calcCost({ inputTokens: 1000, outputTokens: 1000 }, miniSpec)).toBeCloseTo(0.00075, 8);
  });
});
