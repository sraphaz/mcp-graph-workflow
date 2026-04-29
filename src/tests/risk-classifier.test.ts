/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.D1 — risk classifier tests.
 */

import { describe, it, expect } from "vitest";
import { classifyRisk } from "../core/autonomy/risk-classifier.js";

describe("risk-classifier (E22.D1)", () => {
  it("trivial: typo fix in docstring", () => {
    const r = classifyRisk({
      title: "Fix typo in README",
      description: "Whitespace and typo fix in docstring",
      xpSize: "XS",
    });
    expect(r.risk).toBe("trivial");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("low: local refactor without API change", () => {
    const r = classifyRisk({
      title: "Refactor: extract helper from picker",
      description: "Extract pickFromQueue into separate function for readability",
      xpSize: "S",
    });
    expect(r.risk).toBe("low");
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("medium: add new feature", () => {
    const r = classifyRisk({
      title: "Implement new pagination feature",
      description: "Add pagination support to list endpoint",
      xpSize: "M",
    });
    expect(r.risk).toBe("medium");
  });

  it("high: security/auth keyword", () => {
    const r = classifyRisk({
      title: "Update OAuth flow with PKCE",
      description: "Migrate auth middleware to support PKCE for security",
      xpSize: "M",
    });
    expect(r.risk).toBe("high");
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("high: migration keyword", () => {
    const r = classifyRisk({
      title: "Add migration v80 — schema column",
      description: "New schema migration to add foo column",
    });
    expect(r.risk).toBe("high");
  });

  it("conflicting signals (trivial + high) → high with reduced confidence", () => {
    const r = classifyRisk({
      title: "Typo fix in security middleware",
      description: "Fix typo in auth comment",
    });
    expect(r.risk).toBe("high");
    expect(r.confidence).toBeLessThan(0.8);
  });

  it("oversized xpSize escalates to medium even without keywords", () => {
    const r = classifyRisk({
      title: "Some work",
      description: "Doing things",
      xpSize: "L",
    });
    expect(r.risk).toBe("medium");
  });

  it("many files changed → medium", () => {
    const r = classifyRisk({
      title: "Cross-cutting change",
      filesChanged: ["a", "b", "c", "d", "e", "f", "g"],
    });
    expect(r.risk).toBe("medium");
  });

  it("fail-safe: no signals at all → high (low confidence)", () => {
    const r = classifyRisk({});
    expect(r.risk).toBe("high");
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.signals).toContain("no-signals");
  });

  it("returns RiskClassification shape: {risk, confidence, signals[]}", () => {
    const r = classifyRisk({ title: "Refactor extract helper" });
    expect(r).toHaveProperty("risk");
    expect(r).toHaveProperty("confidence");
    expect(Array.isArray(r.signals)).toBe(true);
  });
});
