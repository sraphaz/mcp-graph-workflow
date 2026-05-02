/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { calculateParetoPriority } from "../../core/harness/pareto-priority.js";
import type { HarnessDimension } from "../../core/harness/violation-detail.js";

function gap(dim: HarnessDimension, score: number, weight: number) {
  return { dimension: dim, score, weight, gap: 100 - score };
}

describe("calculateParetoPriority", () => {
  it("returns empty for empty input", () => {
    expect(calculateParetoPriority([])).toEqual([]);
  });

  it("sorts by impact desc (gap × weight)", () => {
    const out = calculateParetoPriority([
      gap("tests" as HarnessDimension, 59, 0.25),
      gap("errors" as HarnessDimension, 100, 0.05),
      gap("provenance" as HarnessDimension, 71, 0.05),
    ]);
    expect(out.map((d) => d.dimension)).toEqual(["tests", "provenance", "errors"]);
  });

  it("computes impact as gap × weight rounded to 2 decimals", () => {
    const out = calculateParetoPriority([
      gap("tests" as HarnessDimension, 59, 0.25),
    ]);
    expect(out[0].impact).toBe(10.25);
  });

  it("marks top 20% as Pareto (minimum 1)", () => {
    const out = calculateParetoPriority([
      gap("tests" as HarnessDimension, 59, 0.25),
      gap("context" as HarnessDimension, 65, 0.05),
      gap("naming" as HarnessDimension, 94, 0.1),
      gap("provenance" as HarnessDimension, 71, 0.05),
      gap("errors" as HarnessDimension, 100, 0.05),
    ]);
    const paretoCount = out.filter((d) => d.isPareto).length;
    expect(paretoCount).toBe(1); // 20% of 5 = 1
    expect(out[0].isPareto).toBe(true);
    expect(out.slice(1).every((d) => !d.isPareto)).toBe(true);
  });

  it("with 1 input, marks it as Pareto (min 1)", () => {
    const out = calculateParetoPriority([
      gap("tests" as HarnessDimension, 50, 0.25),
    ]);
    expect(out[0].isPareto).toBe(true);
  });

  it("preserves score on each output entry", () => {
    const out = calculateParetoPriority([
      gap("tests" as HarnessDimension, 59, 0.25),
    ]);
    expect(out[0].score).toBe(59);
  });
});
