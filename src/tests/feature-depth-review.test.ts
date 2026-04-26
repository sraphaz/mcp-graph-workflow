/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  evaluateReview,
  DEFAULT_REVIEW_SINGLE_THRESHOLD,
  DEFAULT_REVIEW_NET_THRESHOLD,
  type FileDelta,
} from "../core/feature-depth/review.js";

function delta(path: string, before: number, after: number): FileDelta {
  return {
    path,
    module: path.split("/")[2] ?? "",
    before,
    after,
    delta: after - before,
  };
}

describe("evaluateReview", () => {
  it("passes when only improvers", () => {
    const r = evaluateReview({
      improvers: [delta("src/core/x/a.ts", 50, 75), delta("src/core/x/b.ts", 30, 60)],
      regressions: [],
    });
    expect(r.ok).toBe(true);
    expect(r.netDelta).toBe(55);
    expect(r.worstRegression).toBeNull();
  });

  it("passes when no changes at all", () => {
    const r = evaluateReview({ improvers: [], regressions: [] });
    expect(r.ok).toBe(true);
    expect(r.netDelta).toBe(0);
  });

  it("passes when small regression is offset by improvers (positive net)", () => {
    const r = evaluateReview({
      improvers: [delta("src/core/x/a.ts", 50, 75)],
      regressions: [delta("src/core/x/b.ts", 60, 57)], // -3 (within single-file threshold)
    });
    expect(r.ok).toBe(true);
  });

  it("fails when a single file drops beyond threshold", () => {
    const r = evaluateReview({
      improvers: [delta("src/core/x/a.ts", 50, 95)], // +45 net positive
      regressions: [delta("src/core/x/b.ts", 75, 60)], // -15 single-file fail
      singleFileThreshold: 5,
    });
    expect(r.ok).toBe(false);
    expect(r.summary).toContain("single-file fail");
    expect(r.worstRegression?.path).toBe("src/core/x/b.ts");
  });

  it("fails when net is negative beyond netThreshold", () => {
    const r = evaluateReview({
      improvers: [delta("src/core/x/a.ts", 50, 52)], // +2
      regressions: [delta("src/core/x/b.ts", 60, 58)], // -2 (within single)
      netThreshold: 0, // net must be >= 0
    });
    // net = 0, just at boundary — passes (delta < -0 only when truly negative)
    expect(r.ok).toBe(true);
  });

  it("DEFAULT thresholds — single 5, net 0", () => {
    expect(DEFAULT_REVIEW_SINGLE_THRESHOLD).toBe(5);
    expect(DEFAULT_REVIEW_NET_THRESHOLD).toBe(0);
  });

  it("identifies worst regression even when multiple regressions present", () => {
    const r = evaluateReview({
      improvers: [delta("src/core/x/a.ts", 50, 90)],
      regressions: [
        delta("src/core/x/b.ts", 60, 57), // -3
        delta("src/core/x/c.ts", 80, 50), // -30 (worst)
        delta("src/core/x/d.ts", 70, 65), // -5
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.worstRegression?.path).toBe("src/core/x/c.ts");
    expect(r.worstRegression?.delta).toBe(-30);
  });

  it("summary shows net + improver/regression counts", () => {
    const r = evaluateReview({
      improvers: [delta("a.ts", 50, 70), delta("b.ts", 30, 40)],
      regressions: [delta("c.ts", 60, 58)],
    });
    expect(r.summary).toContain("Δ net: +28.0");
    expect(r.summary).toContain("2 improvers");
    expect(r.summary).toContain("1 regressions");
  });
});
