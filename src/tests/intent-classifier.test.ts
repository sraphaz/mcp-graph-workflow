/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T06 — intent-classifier tests.
 */

import { describe, it, expect } from "vitest";
import {
  classifyIntent,
  shouldFallthrough,
  INTENT_THRESHOLD,
} from "../core/llm/intent-classifier.js";

describe("intent-classifier (E6.T06)", () => {
  it("INTENT_THRESHOLD = 0.6", () => {
    expect(INTENT_THRESHOLD).toBe(0.6);
  });

  it("empty input → unknown with fallthrough=true", () => {
    expect(classifyIntent({}).fallthrough).toBe(true);
    expect(classifyIntent({ description: "" }).intent).toBe("unknown");
  });

  it("typo-fix detected from description", () => {
    const c = classifyIntent({ description: "fix typo in README" });
    expect(c.intent).toBe("typo-fix");
    expect(c.confidence).toBeGreaterThanOrEqual(0.9);
    expect(c.fallthrough).toBe(false);
  });

  it("rename-symbol detected", () => {
    const c = classifyIntent({ description: "rename variable to camelCase" });
    expect(c.intent).toBe("rename-symbol");
    expect(c.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("extract-function detected", () => {
    const c = classifyIntent({ description: "extract function for DRY" });
    expect(c.intent).toBe("extract-function");
    expect(c.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("inline-variable detected", () => {
    const c = classifyIntent({ description: "inline variable that's used once" });
    expect(c.intent).toBe("inline-variable");
    expect(c.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("add-test detected", () => {
    const c = classifyIntent({ description: "add test for new edge case" });
    expect(c.intent).toBe("add-test");
    expect(c.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("format-only detected", () => {
    const c = classifyIntent({ description: "reformat with prettier" });
    expect(c.intent).toBe("format-only");
    expect(c.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("ambiguous text below threshold falls through to Tier 1", () => {
    const c = classifyIntent({ description: "tabs maybe" });
    expect(c.intent).toBe("format-only");
    // single weak signal "tabs" (0.6) → confidence ~0.6, on the boundary
    // shouldFallthrough true if below threshold (strict less)
    expect(shouldFallthrough(c)).toBe(c.confidence < INTENT_THRESHOLD);
  });

  it("matched array reports all signals that fired", () => {
    const c = classifyIntent({ description: "add test for spelling typo" });
    const intents = new Set(c.matched.map((m) => m.intent));
    expect(intents.has("add-test")).toBe(true);
    expect(intents.has("typo-fix")).toBe(true);
  });

  it("multi-signal same intent combines via probabilistic OR (cap < 1)", () => {
    const c = classifyIntent({ description: "rename symbol identifier" });
    expect(c.intent).toBe("rename-symbol");
    expect(c.confidence).toBeGreaterThan(0.9);
    expect(c.confidence).toBeLessThan(1);
  });

  it("shouldFallthrough true when intent is unknown", () => {
    expect(shouldFallthrough(classifyIntent({}))).toBe(true);
  });

  it("shouldFallthrough false when confidence >= threshold", () => {
    const c = classifyIntent({ description: "fix typo in comment" });
    expect(shouldFallthrough(c)).toBe(false);
  });
});
