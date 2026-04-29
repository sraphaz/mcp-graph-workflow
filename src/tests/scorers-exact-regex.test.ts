/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset (E18.T03)
 * Tests for exact + regex scorers.
 */

import { describe, it, expect } from "vitest";
import { exactScorer } from "../core/evals/scorers/exact.js";
import { regexScorer } from "../core/evals/scorers/regex.js";

describe("exactScorer (E18.T03)", () => {
  it("returns score=1 + passed=true for exact match", () => {
    const r = exactScorer.score({ output: "hello", expected: "hello" });
    expect(r.score).toBe(1);
    expect(r.passed).toBe(true);
  });

  it("returns score=0 + passed=false on mismatch", () => {
    const r = exactScorer.score({ output: "hello", expected: "world" });
    expect(r.score).toBe(0);
    expect(r.passed).toBe(false);
  });

  it("trims by default (whitespace-insensitive)", () => {
    const r = exactScorer.score({ output: "  hello\n", expected: "hello" });
    expect(r.passed).toBe(true);
  });

  it("trim=false preserves whitespace", () => {
    const r = exactScorer.score({ output: " hello", expected: "hello", trim: false });
    expect(r.passed).toBe(false);
  });

  it("caseSensitive=false matches differing case", () => {
    const r = exactScorer.score({ output: "Hello", expected: "hello", caseSensitive: false });
    expect(r.passed).toBe(true);
  });

  it("caseSensitive default = true", () => {
    const r = exactScorer.score({ output: "Hello", expected: "hello" });
    expect(r.passed).toBe(false);
  });

  it("kind = 'exact'", () => {
    expect(exactScorer.kind).toBe("exact");
  });
});

describe("regexScorer (E18.T03)", () => {
  it("returns passed=true when output matches expected pattern", () => {
    const r = regexScorer.score({ output: "v1.2.3", expected: "^v\\d+\\.\\d+\\.\\d+$" });
    expect(r.passed).toBe(true);
    expect(r.score).toBe(1);
  });

  it("returns passed=false when no match", () => {
    const r = regexScorer.score({ output: "abc", expected: "^\\d+$" });
    expect(r.passed).toBe(false);
    expect(r.score).toBe(0);
  });

  it("supports flags option", () => {
    const r = regexScorer.score({ output: "HELLO", expected: "hello", flags: "i" });
    expect(r.passed).toBe(true);
  });

  it("returns passed=false and details when expected is invalid regex", () => {
    const r = regexScorer.score({ output: "x", expected: "(unclosed" });
    expect(r.passed).toBe(false);
    expect(r.score).toBe(0);
    expect(r.details).toBeTruthy();
  });

  it("kind = 'regex'", () => {
    expect(regexScorer.kind).toBe("regex");
  });
});
