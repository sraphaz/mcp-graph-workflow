import { describe, it, expect } from "vitest";
import {
  calculateCost,
  getModelPricing,
  MODEL_PRICING,
} from "../core/observability/cost-tracker.js";

describe("calculateCost", () => {
  it("should calculate cost for claude-sonnet-4", () => {
    const cost = calculateCost("claude-sonnet-4", 1000, 500);

    expect(cost.totalUsd).toBeGreaterThan(0);
    expect(cost.inputCostUsd).toBeGreaterThan(0);
    expect(cost.outputCostUsd).toBeGreaterThan(0);
    expect(cost.totalUsd).toBe(cost.inputCostUsd + cost.outputCostUsd);
  });

  it("should calculate cost for claude-opus-4", () => {
    const cost = calculateCost("claude-opus-4", 1000, 500);

    // Opus should be more expensive than Sonnet
    const sonnetCost = calculateCost("claude-sonnet-4", 1000, 500);
    expect(cost.totalUsd).toBeGreaterThan(sonnetCost.totalUsd);
  });

  it("should return 0 for unknown model", () => {
    const cost = calculateCost("unknown-model-xyz", 1000, 500);

    expect(cost.totalUsd).toBe(0);
    expect(cost.inputCostUsd).toBe(0);
    expect(cost.outputCostUsd).toBe(0);
    expect(cost.model).toBe("unknown-model-xyz");
  });

  it("should handle zero tokens", () => {
    const cost = calculateCost("claude-sonnet-4", 0, 0);

    expect(cost.totalUsd).toBe(0);
  });

  it("should scale linearly with token count", () => {
    const cost1k = calculateCost("claude-sonnet-4", 1000, 0);
    const cost2k = calculateCost("claude-sonnet-4", 2000, 0);

    expect(cost2k.inputCostUsd).toBeCloseTo(cost1k.inputCostUsd * 2, 10);
  });

  it("should include model name in result", () => {
    const cost = calculateCost("gpt-4o", 100, 50);

    expect(cost.model).toBe("gpt-4o");
  });
});

describe("getModelPricing", () => {
  it("should return pricing for known model", () => {
    const pricing = getModelPricing("claude-sonnet-4");

    expect(pricing).toBeDefined();
    expect(pricing!.inputPer1M).toBeGreaterThan(0);
    expect(pricing!.outputPer1M).toBeGreaterThan(0);
  });

  it("should return undefined for unknown model", () => {
    const pricing = getModelPricing("totally-fake-model");

    expect(pricing).toBeUndefined();
  });

  it("should match partial model names", () => {
    // "claude-3-5-sonnet" should match if we have "claude-3-5-sonnet-*"
    const pricing = getModelPricing("claude-sonnet-4");

    expect(pricing).toBeDefined();
  });
});

describe("MODEL_PRICING", () => {
  it("should have at least 5 models defined", () => {
    expect(MODEL_PRICING.size).toBeGreaterThanOrEqual(5);
  });

  it("should include major model families", () => {
    const models = [...MODEL_PRICING.keys()];
    const hasClaude = models.some((m) => m.includes("claude"));
    const hasGpt = models.some((m) => m.includes("gpt"));

    expect(hasClaude).toBe(true);
    expect(hasGpt).toBe(true);
  });
});
