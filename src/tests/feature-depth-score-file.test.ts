/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * TS port of tools/feature-depth/analyzer/file_test.go.
 *
 * The Go implementation in tools/feature-depth/ is the canonical
 * scorer for standalone audit; this TS module is the lifecycle hot-path
 * implementation used by finish_task. Tests mirror the Go suite so
 * drift between the two implementations is detectable.
 */

import { describe, it, expect } from "vitest";
import {
  scoreFile,
  DEFAULT_FILE_WEIGHTS,
  type FileScoreInput,
} from "../core/feature-depth/score-file.js";

function input(overrides: Partial<FileScoreInput> = {}): FileScoreInput {
  return {
    relPath: "src/x/foo.ts",
    module: "x",
    content: "export function f() {}\n",
    sourceLoc: 1,
    testLoc: 0,
    ...overrides,
  };
}

describe("scoreFile", () => {
  it("returns score in [0, 100]", () => {
    const r = scoreFile(input());
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("testDensity is 0 when no test exists", () => {
    const r = scoreFile(input({ testLoc: 0 }));
    expect(r.dimensions.testDensity).toBe(0);
    expect(r.dimensions.hasTest).toBe(false);
  });

  it("testDensity is capped at 1.0 even for huge test ratios", () => {
    const r = scoreFile(input({ sourceLoc: 10, testLoc: 50 }));
    expect(r.dimensions.testDensity).toBe(1.0);
    expect(r.dimensions.hasTest).toBe(true);
  });

  it("typeSafety penalizes any usage", () => {
    const clean = scoreFile(input({
      content: "export function f(x: number): number { return x; }\n",
    }));
    const dirty = scoreFile(input({
      content: "export function f(x: any): any { return x as any; }\n",
    }));
    expect(dirty.dimensions.typeSafety).toBeLessThan(clean.dimensions.typeSafety);
  });

  it("score rises when adjacent tests are added (the spread-strategy invariant)", () => {
    const src =
      "export function add(a: number, b: number): number { return a + b; }\n" +
      "export function sub(a: number, b: number): number { return a - b; }\n";
    const noTest = scoreFile(input({ content: src, sourceLoc: 2, testLoc: 0 }));
    const withTest = scoreFile(input({ content: src, sourceLoc: 2, testLoc: 24 }));
    expect(withTest.score).toBeGreaterThan(noTest.score);
  });

  it("errorHandling rewards typed errors over raw Error", () => {
    const typed = scoreFile(input({
      content:
        "class FooError extends Error {}\n" +
        "export function f() { try { x(); } catch (e) { throw new FooError('msg'); } }\n",
    }));
    const raw = scoreFile(input({
      content:
        "export function f() { try { x(); } catch (e) { throw new Error('msg'); } }\n",
    }));
    expect(typed.dimensions.errorHandling).toBeGreaterThan(raw.dimensions.errorHandling);
  });

  it("validationCoverage rewards Zod parse calls", () => {
    const validated = scoreFile(input({
      content:
        "import { z } from 'zod';\n" +
        "const Schema = z.object({});\n" +
        "export function f(x: unknown) { return Schema.parse(x); }\n",
    }));
    const unvalidated = scoreFile(input({
      content: "export function f(x: unknown) { return x; }\n",
    }));
    expect(validated.dimensions.validationCoverage).toBeGreaterThan(
      unvalidated.dimensions.validationCoverage,
    );
  });

  it("edgeCaseHandling rewards guard clauses + nullish coalescing", () => {
    const defensive = scoreFile(input({
      content:
        "export function f(x?: string) {\n" +
        "  if (!x) throw new Error('missing');\n" +
        "  return x?.trim() ?? '';\n" +
        "}\n",
    }));
    const naive = scoreFile(input({
      content: "export function f(x: string) { return x.trim(); }\n",
    }));
    expect(defensive.dimensions.edgeCaseHandling).toBeGreaterThan(
      naive.dimensions.edgeCaseHandling,
    );
  });

  it("returned dimensions object has all six fields", () => {
    const r = scoreFile(input());
    expect(r.dimensions).toHaveProperty("testDensity");
    expect(r.dimensions).toHaveProperty("hasTest");
    expect(r.dimensions).toHaveProperty("errorHandling");
    expect(r.dimensions).toHaveProperty("typeSafety");
    expect(r.dimensions).toHaveProperty("validationCoverage");
    expect(r.dimensions).toHaveProperty("edgeCaseHandling");
  });

  it("DEFAULT_FILE_WEIGHTS sum to 1.0", () => {
    const w = DEFAULT_FILE_WEIGHTS;
    const sum =
      w.testDensity +
      w.hasTest +
      w.errorHandling +
      w.typeSafety +
      w.validationCoverage +
      w.edgeCaseHandling;
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
  });

  it("matches the Go canonical weights (drift detector)", () => {
    // If these change, tools/feature-depth/analyzer/file.go must change in
    // lockstep — same rationale, same calibration. See plan: schema drift
    // risk note.
    expect(DEFAULT_FILE_WEIGHTS.testDensity).toBeCloseTo(0.30, 5);
    expect(DEFAULT_FILE_WEIGHTS.hasTest).toBeCloseTo(0.15, 5);
    expect(DEFAULT_FILE_WEIGHTS.errorHandling).toBeCloseTo(0.15, 5);
    expect(DEFAULT_FILE_WEIGHTS.typeSafety).toBeCloseTo(0.20, 5);
    expect(DEFAULT_FILE_WEIGHTS.validationCoverage).toBeCloseTo(0.10, 5);
    expect(DEFAULT_FILE_WEIGHTS.edgeCaseHandling).toBeCloseTo(0.10, 5);
  });

  it("optional coverage override replaces the LOC heuristic", () => {
    // High testLoc would give density ~1.0 via the heuristic, but real
    // coverage of 30% should drive density down to 0.3.
    const heuristic = scoreFile(input({ sourceLoc: 10, testLoc: 100 }));
    const realCov = scoreFile(
      input({ sourceLoc: 10, testLoc: 100 }),
      30, // 30% real statements covered
    );
    expect(heuristic.dimensions.testDensity).toBe(1.0);
    expect(realCov.dimensions.testDensity).toBeCloseTo(0.30, 5);
  });
});
