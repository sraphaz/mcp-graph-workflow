/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  checkFeatureDepthRegression,
  DEFAULT_REGRESSION_THRESHOLD,
} from "../core/feature-depth/regression-gate.js";

describe("checkFeatureDepthRegression", () => {
  it("passes when score did not change", () => {
    const r = checkFeatureDepthRegression({
      relPath: "src/foo.ts",
      before: 60,
      after: 60,
    });
    expect(r.regressed).toBe(false);
    expect(r.delta).toBe(0);
  });

  it("passes when score went up", () => {
    const r = checkFeatureDepthRegression({
      relPath: "src/foo.ts",
      before: 50,
      after: 75,
    });
    expect(r.regressed).toBe(false);
    expect(r.delta).toBe(25);
  });

  it("passes when score dropped within threshold", () => {
    const r = checkFeatureDepthRegression({
      relPath: "src/foo.ts",
      before: 60,
      after: 57,
      threshold: 5,
    });
    expect(r.regressed).toBe(false);
    expect(r.delta).toBe(-3);
  });

  it("flags regression when score dropped beyond threshold", () => {
    const r = checkFeatureDepthRegression({
      relPath: "src/foo.ts",
      before: 60,
      after: 50,
      threshold: 5,
    });
    expect(r.regressed).toBe(true);
    expect(r.delta).toBe(-10);
    expect(r.message).toContain("foo.ts");
    expect(r.message).toContain("-10");
  });

  it("uses DEFAULT_REGRESSION_THRESHOLD (5) when threshold is omitted", () => {
    const inside = checkFeatureDepthRegression({
      relPath: "x", before: 60, after: 56,
    });
    const outside = checkFeatureDepthRegression({
      relPath: "x", before: 60, after: 54,
    });
    expect(inside.regressed).toBe(false);
    expect(outside.regressed).toBe(true);
    expect(DEFAULT_REGRESSION_THRESHOLD).toBe(5);
  });

  it("treats no-baseline (before=null) as a fresh file — never regresses", () => {
    const r = checkFeatureDepthRegression({
      relPath: "src/new.ts",
      before: null,
      after: 30,
    });
    expect(r.regressed).toBe(false);
    expect(r.delta).toBe(0);
  });

  it("handles edge thresholds (threshold=0 — any drop regresses)", () => {
    const r = checkFeatureDepthRegression({
      relPath: "x",
      before: 60,
      after: 59,
      threshold: 0,
    });
    expect(r.regressed).toBe(true);
  });
});
