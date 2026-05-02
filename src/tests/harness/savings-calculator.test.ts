/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * computeSavings — pure token-savings estimator for harness blocks.
 *
 * Eduardo's spec: when the harness blocks an action that would have led to
 * a hallucination / quality drop / context loss, the graph must record
 * "with real metrics, how many tokens were saved". The calculator is the
 * arithmetic part — DB lookup happens elsewhere; this module only
 * combines (tokensConsumed, baselineContinuation) into a single
 * SavingsEstimate with a confidence score.
 *
 * AC1 — savings = baselineContinuation − tokensConsumed when positive
 * AC2 — savings clamped to 0 when tokensConsumed ≥ baseline (no waste avoided)
 * AC3 — confidence scales with baseline sample size (cap at 1.0 at N=10)
 * AC4 — source="measured" when baselineN ≥ 3, "estimated" when 1≤N<3,
 *       "unknown" when N=0 (uses fallback default)
 * AC5 — fallback default returns when no baseline (savings=0, confidence=0)
 * AC6 — never returns negative tokens or confidence > 1
 */

import { describe, it, expect } from "vitest";
import { computeSavings } from "../../core/harness/savings-calculator.js";

describe("computeSavings", () => {
  it("AC1 — savings = baselineContinuation − tokensConsumed", () => {
    const result = computeSavings({
      blockType: "regression_gate",
      tokensConsumed: 4000,
      baselineContinuation: 12_000,
      baselineN: 5,
    });
    expect(result.savingsTokens).toBe(8000);
  });

  it("AC2 — savings clamped to 0 when tokensConsumed ≥ baseline", () => {
    const result = computeSavings({
      blockType: "regression_gate",
      tokensConsumed: 15_000,
      baselineContinuation: 12_000,
      baselineN: 5,
    });
    expect(result.savingsTokens).toBe(0);
  });

  it("AC3 — confidence is N/10 capped at 1.0", () => {
    expect(
      computeSavings({
        blockType: "any",
        tokensConsumed: 1,
        baselineContinuation: 100,
        baselineN: 0,
      }).confidence,
    ).toBe(0);

    expect(
      computeSavings({
        blockType: "any",
        tokensConsumed: 1,
        baselineContinuation: 100,
        baselineN: 5,
      }).confidence,
    ).toBeCloseTo(0.5, 3);

    expect(
      computeSavings({
        blockType: "any",
        tokensConsumed: 1,
        baselineContinuation: 100,
        baselineN: 10,
      }).confidence,
    ).toBe(1);

    expect(
      computeSavings({
        blockType: "any",
        tokensConsumed: 1,
        baselineContinuation: 100,
        baselineN: 100,
      }).confidence,
    ).toBe(1);
  });

  it('AC4 — source="measured" when baselineN ≥ 3', () => {
    const result = computeSavings({
      blockType: "any",
      tokensConsumed: 100,
      baselineContinuation: 1000,
      baselineN: 3,
    });
    expect(result.source).toBe("measured");
  });

  it('AC4 — source="estimated" when 1 ≤ baselineN < 3', () => {
    const result = computeSavings({
      blockType: "any",
      tokensConsumed: 100,
      baselineContinuation: 1000,
      baselineN: 1,
    });
    expect(result.source).toBe("estimated");
  });

  it('AC4 — source="unknown" when baselineN = 0 (fallback path)', () => {
    const result = computeSavings({
      blockType: "any",
      tokensConsumed: 100,
      baselineContinuation: 0,
      baselineN: 0,
    });
    expect(result.source).toBe("unknown");
    expect(result.savingsTokens).toBe(0);
  });

  it("AC5 — fallback when baselineN=0: savings=0, confidence=0", () => {
    const result = computeSavings({
      blockType: "regression_gate",
      tokensConsumed: 5000,
      baselineContinuation: 0,
      baselineN: 0,
    });
    expect(result.savingsTokens).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("AC6 — savingsTokens is never negative", () => {
    const result = computeSavings({
      blockType: "any",
      tokensConsumed: 1_000_000,
      baselineContinuation: 100,
      baselineN: 5,
    });
    expect(result.savingsTokens).toBeGreaterThanOrEqual(0);
  });

  it("AC6 — confidence never exceeds 1", () => {
    const result = computeSavings({
      blockType: "any",
      tokensConsumed: 1,
      baselineContinuation: 100,
      baselineN: 9999,
    });
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("returns the documented SavingsEstimate shape", () => {
    const result = computeSavings({
      blockType: "regression_gate",
      tokensConsumed: 1000,
      baselineContinuation: 5000,
      baselineN: 4,
    });
    expect(result).toHaveProperty("savingsTokens");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("source");
    expect(result).toHaveProperty("blockType");
    expect(result).toHaveProperty("baselineN");
  });

  it("preserves blockType in the result for downstream aggregation", () => {
    const result = computeSavings({
      blockType: "lifecycle_gate",
      tokensConsumed: 100,
      baselineContinuation: 500,
      baselineN: 2,
    });
    expect(result.blockType).toBe("lifecycle_gate");
  });
});
