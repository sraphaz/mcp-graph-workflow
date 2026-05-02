/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §autonomous-iter-1 — runHarnessScan caps merged violations at
 * `maxViolations`, but the previous implementation truncated whole
 * dimensions when earlier dimensions filled the budget alone (eg
 * `tests` had 443 entries, eating the entire 500-cap before `errors`
 * could be appended). This made `analyze(harness_remediate)` report 0
 * error-dimension fixes despite `errors=0%`.
 *
 * The fix distributes the cap fairly across dimensions so each
 * dimension is represented proportionally to its total count, capped
 * by `maxPerDimension`.
 */

import { describe, it, expect } from "vitest";
import type { ViolationDetail } from "../core/harness/violation-detail.js";
import { distributeViolationsFairly } from "../core/harness/violation-distribution.js";

function v(dim: string, file: string, n = 1): ViolationDetail[] {
  return Array.from({ length: n }, (_, i) => ({
    file: `${file}-${i}`,
    line: i + 1,
    dimension: dim as ViolationDetail["dimension"],
    violationType: `${dim}_violation`,
    evidence: "synthetic",
    confidence: 1.0,
  }));
}

describe("distributeViolationsFairly", () => {
  it("returns all violations when total <= maxViolations", () => {
    const all = [...v("types", "a", 5), ...v("tests", "b", 10)];
    const r = distributeViolationsFairly(all, 100);
    expect(r).toHaveLength(15);
  });

  it("represents every dimension when one dominates", () => {
    // Mirrors real-world: 443 tests, 46 naming, 11 types, 50 errors
    const all = [
      ...v("tests", "t", 443),
      ...v("naming", "n", 46),
      ...v("types", "y", 11),
      ...v("errors", "e", 50),
    ];
    const r = distributeViolationsFairly(all, 500);

    const byDim: Record<string, number> = {};
    for (const x of r) byDim[x.dimension] = (byDim[x.dimension] ?? 0) + 1;

    // Every present dimension must surface in the output (no whole-dimension drops)
    expect(byDim.tests).toBeGreaterThan(0);
    expect(byDim.naming).toBeGreaterThan(0);
    expect(byDim.types).toBeGreaterThan(0);
    expect(byDim.errors).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(500);
  });

  it("preserves all violations of small dimensions when budget allows", () => {
    const all = [
      ...v("tests", "t", 443),
      ...v("errors", "e", 5),
    ];
    const r = distributeViolationsFairly(all, 500);
    const errors = r.filter((x: ViolationDetail) => x.dimension === "errors");
    // All 5 error violations should be present (small dimensions never truncate
    // when the cap is generous)
    expect(errors).toHaveLength(5);
  });

  it("respects maxPerDimension when provided", () => {
    const all = [...v("tests", "t", 200), ...v("errors", "e", 200)];
    const r = distributeViolationsFairly(all, 1000, 50);
    const byDim: Record<string, number> = {};
    for (const x of r) byDim[x.dimension] = (byDim[x.dimension] ?? 0) + 1;
    expect(byDim.tests).toBe(50);
    expect(byDim.errors).toBe(50);
    expect(r).toHaveLength(100);
  });

  it("returns [] for empty input", () => {
    expect(distributeViolationsFairly([], 100)).toEqual([]);
  });

  it("orders dimensions by smallest-first to maximize coverage diversity", () => {
    const all = [
      ...v("tests", "t", 100),
      ...v("errors", "e", 5),
      ...v("types", "y", 20),
    ];
    const r = distributeViolationsFairly(all, 50);
    // Smaller dimensions should appear first in output for cap-friendly ordering
    const firstDim = r[0]!.dimension;
    expect(["errors", "types"]).toContain(firstDim);
  });
});
