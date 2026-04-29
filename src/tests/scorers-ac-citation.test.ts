/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset (E18.T04).
 * Tests for ac-quality and citation-coverage scorers.
 */

import { describe, it, expect } from "vitest";
import { acQualityScorer } from "../core/evals/scorers/ac-quality.js";
import { citationCoverageScorer } from "../core/evals/scorers/citation-coverage.js";

describe("acQualityScorer (E18.T04)", () => {
  it("kind = 'ac-quality'", () => {
    expect(acQualityScorer.kind).toBe("ac-quality");
  });

  it("returns high score for testable, measurable ACs", () => {
    const r = acQualityScorer.score({
      output: [
        "GoldenStore.create returns id and createdAt and persists row to eval_golden",
        "GoldenStore.list filters by tool and respects limit parameter",
        "GoldenStore.delete returns false when id is missing",
      ],
    });
    expect(r.score).toBeGreaterThanOrEqual(0.6);
    expect(r.passed).toBe(true);
  });

  it("returns lower score for vague ACs than for testable ACs", () => {
    const vague = acQualityScorer.score({
      output: ["it should work nicely", "should be fast", "user friendly"],
    });
    const testable = acQualityScorer.score({
      output: [
        "GoldenStore.create returns id and persists row to eval_golden",
        "GoldenStore.list filters by tool and respects limit",
      ],
    });
    expect(vague.score).toBeLessThanOrEqual(testable.score);
  });

  it("respects custom threshold", () => {
    const r = acQualityScorer.score({
      output: ["it should work"],
      threshold: 1, // even tiny score >= 0.01 passes
    });
    expect(r.passed).toBe(true);
  });

  it("accepts a single string and splits on newlines", () => {
    const r = acQualityScorer.score({
      output:
        "GoldenStore.create returns id and persists row\nGoldenStore.delete returns false when id missing",
    });
    expect(r.score).toBeGreaterThan(0);
  });

  it("returns score=0 + passed=false for empty input", () => {
    const r = acQualityScorer.score({ output: [] });
    expect(r.score).toBe(0);
    expect(r.passed).toBe(false);
  });
});

describe("citationCoverageScorer (E18.T04)", () => {
  it("kind = 'citation-coverage'", () => {
    expect(citationCoverageScorer.kind).toBe("citation-coverage");
  });

  it("passes when at least one citation present (no expected)", () => {
    const r = citationCoverageScorer.score({
      output: "// §EPIC-18.T04 — refactor",
    });
    expect(r.score).toBe(1);
    expect(r.passed).toBe(true);
  });

  it("fails when no citation present (no expected)", () => {
    const r = citationCoverageScorer.score({
      output: "// just a comment",
    });
    expect(r.score).toBe(0);
    expect(r.passed).toBe(false);
  });

  it("computes fraction of expected citations found when expected provided", () => {
    const r = citationCoverageScorer.score({
      output: "see §EPIC-18.T04 and §ADR-0049 for context",
      expected: ["§EPIC-18.T04", "§ADR-0049", "§EPIC-17.T01"],
    });
    expect(r.score).toBeCloseTo(2 / 3);
    expect(r.passed).toBe(false); // 0.667 < 1.0 default threshold
  });

  it("passes when all expected citations present", () => {
    const r = citationCoverageScorer.score({
      output: "§EPIC-18.T04 §ADR-0049",
      expected: ["§EPIC-18.T04", "§ADR-0049"],
    });
    expect(r.score).toBe(1);
    expect(r.passed).toBe(true);
  });

  it("respects custom threshold", () => {
    const r = citationCoverageScorer.score({
      output: "§EPIC-18.T04",
      expected: ["§EPIC-18.T04", "§ADR-0049"],
      threshold: 0.5,
    });
    expect(r.score).toBe(0.5);
    expect(r.passed).toBe(true);
  });
});
