/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-11.T03 — cache-aware pricing tests.
 */

import { describe, it, expect } from "vitest";
import {
  computeCachedCost,
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_MULTIPLIER,
} from "../core/llm/pricing-cache.js";

const RATES = { inputRate: 3 / 1_000_000, outputRate: 15 / 1_000_000 };

describe("pricing-cache (E11.T03)", () => {
  it("multipliers: read=0.1, write=1.25", () => {
    expect(CACHE_READ_MULTIPLIER).toBe(0.1);
    expect(CACHE_WRITE_MULTIPLIER).toBe(1.25);
  });

  it("plain only: cost = inputTokens * rate + outputTokens * outputRate", () => {
    const r = computeCachedCost(
      { inputTokens: 1000, outputTokens: 500 },
      RATES,
    );
    expect(r.plainInputTokens).toBe(1000);
    expect(r.cachedTokens).toBe(0);
    expect(r.totalUsd).toBeCloseTo(1000 * RATES.inputRate + 500 * RATES.outputRate);
  });

  it("plain_input subtracts cached + created from inputTokens (clamped to 0)", () => {
    const r = computeCachedCost(
      { inputTokens: 1000, outputTokens: 0, cachedTokens: 800, cacheCreationTokens: 100 },
      RATES,
    );
    expect(r.plainInputTokens).toBe(100); // 1000 - 800 - 100
    expect(r.cachedTokens).toBe(800);
    expect(r.cacheCreationTokens).toBe(100);
  });

  it("cached read costs 10% of input rate", () => {
    const r = computeCachedCost(
      { inputTokens: 1000, outputTokens: 0, cachedTokens: 1000 },
      RATES,
    );
    expect(r.plainInputTokens).toBe(0);
    expect(r.cachedCostUsd).toBeCloseTo(1000 * RATES.inputRate * 0.1);
    expect(r.totalUsd).toBeCloseTo(r.cachedCostUsd);
  });

  it("cache creation costs 125% of input rate", () => {
    const r = computeCachedCost(
      { inputTokens: 1000, outputTokens: 0, cacheCreationTokens: 1000 },
      RATES,
    );
    expect(r.creationCostUsd).toBeCloseTo(1000 * RATES.inputRate * 1.25);
    expect(r.totalUsd).toBeCloseTo(r.creationCostUsd);
  });

  it("totalUsd sums plain + cached + creation + output", () => {
    const r = computeCachedCost(
      {
        inputTokens: 1000, outputTokens: 200,
        cachedTokens: 600, cacheCreationTokens: 300,
      },
      RATES,
    );
    const expected =
      100 * RATES.inputRate +
      600 * RATES.inputRate * 0.1 +
      300 * RATES.inputRate * 1.25 +
      200 * RATES.outputRate;
    expect(r.totalUsd).toBeCloseTo(expected);
  });

  it("clamps when cached + created > inputTokens (defensive: plain=0)", () => {
    const r = computeCachedCost(
      { inputTokens: 100, outputTokens: 0, cachedTokens: 200, cacheCreationTokens: 100 },
      RATES,
    );
    expect(r.plainInputTokens).toBe(0);
  });

  it("treats undefined/NaN/negative cache fields as 0", () => {
    const r = computeCachedCost(
      { inputTokens: 1000, outputTokens: 0, cachedTokens: undefined, cacheCreationTokens: -50 },
      RATES,
    );
    expect(r.cachedTokens).toBe(0);
    expect(r.cacheCreationTokens).toBe(0);
    expect(r.plainInputTokens).toBe(1000);
  });

  it("zero tokens → zero cost", () => {
    const r = computeCachedCost({ inputTokens: 0, outputTokens: 0 }, RATES);
    expect(r.totalUsd).toBe(0);
  });
});
