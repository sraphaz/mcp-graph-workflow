/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Characterization tests for distributeViolationsFairly — locks the
 * §autonomous-iter-1 fair-distribution contract: smallest dimensions
 * first so the cap reaches every dimension.
 */

import { describe, it, expect } from "vitest";
import { distributeViolationsFairly } from "../../core/harness/violation-distribution.js";
import type { ViolationDetail } from "../../core/harness/violation-detail.js";

function v(dimension: string, suffix: number): ViolationDetail {
  return {
    file: `f${suffix}.ts`,
    line: 1,
    dimension,
    violationType: "x",
    evidence: "e",
    confidence: 1,
  } as ViolationDetail;
}

describe("distributeViolationsFairly", () => {
  it("returns empty array for empty input", () => {
    expect(distributeViolationsFairly([], 100)).toEqual([]);
  });

  it("respects the global cap when total > maxViolations", () => {
    const all = Array.from({ length: 30 }, (_, i) => v("tests", i));
    const out = distributeViolationsFairly(all, 10);
    expect(out).toHaveLength(10);
  });

  it("returns all violations when total ≤ cap", () => {
    const all = [v("a", 0), v("a", 1), v("b", 0)];
    const out = distributeViolationsFairly(all, 100);
    expect(out).toHaveLength(3);
  });

  it("smallest dimension is fully included before large dimensions share leftover", () => {
    // 1 errors + 50 tests; cap=10. Without fair distribution, errors
    // would be pushed off the end; with it, errors must appear.
    const all = [v("errors", 0), ...Array.from({ length: 50 }, (_, i) => v("tests", i))];
    const out = distributeViolationsFairly(all, 10);
    const dims = out.map((x) => x.dimension);
    expect(dims).toContain("errors");
  });

  it("every present dimension surfaces in the output (with room)", () => {
    const all = [
      v("naming", 0),
      v("tests", 0),
      v("tests", 1),
      v("docs", 0),
      v("errors", 0),
    ];
    const out = distributeViolationsFairly(all, 5);
    const uniqueDims = new Set(out.map((x) => x.dimension));
    expect(uniqueDims).toEqual(new Set(["naming", "tests", "docs", "errors"]));
  });

  it("maxPerDimension caps each dimension's contribution", () => {
    const all = Array.from({ length: 20 }, (_, i) => v("tests", i));
    const out = distributeViolationsFairly(all, 100, 5);
    expect(out).toHaveLength(5);
  });

  it("preserves insertion order within each dimension", () => {
    const all = [v("a", 0), v("a", 1), v("a", 2)];
    const out = distributeViolationsFairly(all, 100);
    expect(out.map((x) => x.file)).toEqual(["f0.ts", "f1.ts", "f2.ts"]);
  });

  it("zero cap produces empty output", () => {
    const all = [v("a", 0), v("b", 0)];
    expect(distributeViolationsFairly(all, 0)).toEqual([]);
  });

  it("guarantees at least 1 slot per dimension when cap ≥ dimensionCount", () => {
    const all = [v("a", 0), v("a", 1), v("b", 0), v("b", 1), v("c", 0)];
    const out = distributeViolationsFairly(all, 3);
    const uniqueDims = new Set(out.map((x) => x.dimension));
    expect(uniqueDims.size).toBe(3);
  });
});
