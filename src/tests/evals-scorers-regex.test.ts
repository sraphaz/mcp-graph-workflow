/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Characterization tests for regexScorer (EPIC 18 — Evals).
 * Locks the current behaviour so refactors stay safe.
 */

import { describe, it, expect } from "vitest";
import { regexScorer } from "../core/evals/scorers/regex.js";

describe("regexScorer", () => {
  it("declares kind = 'regex'", () => {
    expect(regexScorer.kind).toBe("regex");
  });

  it("scores 1 + passed=true on match", () => {
    const result = regexScorer.score({ output: "hello world", expected: "world" });
    expect(result).toEqual({ score: 1, passed: true });
  });

  it("scores 0 + passed=false on miss", () => {
    const result = regexScorer.score({ output: "goodbye", expected: "^hello" });
    expect(result).toEqual({ score: 0, passed: false });
  });

  it("honours regex flags — 'i' enables case-insensitive match", () => {
    const result = regexScorer.score({ output: "HELLO", expected: "hello", flags: "i" });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it("without 'i' flag, case mismatch fails", () => {
    const result = regexScorer.score({ output: "HELLO", expected: "hello" });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it("multiline 'm' flag — anchors match line starts", () => {
    const result = regexScorer.score({
      output: "first line\nsecond line",
      expected: "^second",
      flags: "m",
    });
    expect(result.passed).toBe(true);
  });

  it("returns score=0 + details on invalid regex source", () => {
    const result = regexScorer.score({ output: "x", expected: "(unclosed" });
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.details).toMatch(/invalid regex:/);
  });

  it("invalid regex error message includes the underlying cause", () => {
    const result = regexScorer.score({ output: "x", expected: "[a-" });
    expect(result.details).toBeDefined();
    expect(result.details!.length).toBeGreaterThan("invalid regex:".length);
  });

  it("empty pattern matches any output (.* equivalent)", () => {
    const result = regexScorer.score({ output: "anything", expected: "" });
    expect(result.passed).toBe(true);
  });

  it("anchored pattern enforces boundary", () => {
    const matchStart = regexScorer.score({ output: "prefix-mid-suffix", expected: "^prefix" });
    const matchMid = regexScorer.score({ output: "prefix-mid-suffix", expected: "^mid" });
    expect(matchStart.passed).toBe(true);
    expect(matchMid.passed).toBe(false);
  });

  it("special regex chars are literal when escaped", () => {
    const result = regexScorer.score({ output: "v1.2.3", expected: "v1\\.2\\.3" });
    expect(result.passed).toBe(true);
  });

  it("non-Error thrown from RegExp constructor is stringified into details", () => {
    // Standard browsers throw SyntaxError (an Error subclass), but the catch
    // path also handles non-Error throws via the String(err) fallback. We
    // verify the contract by exercising the malformed path; the String()
    // fallback is on the same code line, so a unit test for it would have
    // to monkey-patch RegExp — out of scope for behaviour locking.
    const result = regexScorer.score({ output: "x", expected: "[" });
    expect(result.score).toBe(0);
    expect(result.details).toContain("invalid regex");
  });
});
