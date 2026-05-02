/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { evaluateSurgicalScope } from "../core/implementer/surgical-scope.js";

describe("evaluateSurgicalScope", () => {
  it("passes when no declared scope (skip — avoid false positive)", () => {
    const result = evaluateSurgicalScope({
      declaredFiles: [],
      modifiedFiles: ["src/foo.ts", "src/bar.ts"],
    });

    expect(result.passed).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.details).toMatch(/no declared|n\/a|skip/i);
  });

  it("passes when no modified files reported (nothing to compare)", () => {
    const result = evaluateSurgicalScope({
      declaredFiles: ["src/foo.ts"],
      modifiedFiles: [],
    });

    expect(result.passed).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it("passes when 100% of modified files are within declared scope", () => {
    const result = evaluateSurgicalScope({
      declaredFiles: ["src/foo.ts", "src/bar.ts"],
      modifiedFiles: ["src/foo.ts", "src/bar.ts"],
    });

    expect(result.passed).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.outOfScopeRatio).toBe(0);
    expect(result.outOfScopeFiles).toHaveLength(0);
  });

  it("passes when out-of-scope ratio is below 30%", () => {
    const result = evaluateSurgicalScope({
      declaredFiles: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"],
      modifiedFiles: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/extra.ts"],
    });

    // 1/5 = 20% out of scope → passes
    expect(result.passed).toBe(true);
    expect(result.outOfScopeRatio).toBeCloseTo(0.2, 2);
  });

  it("fails when out-of-scope ratio exceeds 30%", () => {
    const result = evaluateSurgicalScope({
      declaredFiles: ["src/a.ts"],
      modifiedFiles: ["src/a.ts", "src/extra1.ts", "src/extra2.ts"],
    });

    // 2/3 ≈ 67% out of scope → fails
    expect(result.passed).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.outOfScopeRatio).toBeGreaterThan(0.3);
    expect(result.outOfScopeFiles).toEqual(["src/extra1.ts", "src/extra2.ts"]);
  });

  it("normalizes paths (relative vs absolute) when comparing", () => {
    const result = evaluateSurgicalScope({
      declaredFiles: ["/repo/src/foo.ts"],
      modifiedFiles: ["src/foo.ts"],
      cwd: "/repo",
    });

    expect(result.passed).toBe(true);
    expect(result.outOfScopeRatio).toBe(0);
  });

  it("respects custom threshold", () => {
    const result = evaluateSurgicalScope({
      declaredFiles: ["src/a.ts"],
      modifiedFiles: ["src/a.ts", "src/extra.ts"],
      thresholdRatio: 0.6,
    });

    // 1/2 = 50% out of scope; threshold 60% → passes
    expect(result.passed).toBe(true);
  });
});
