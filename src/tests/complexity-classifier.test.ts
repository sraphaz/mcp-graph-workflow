/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T08 — complexity-classifier tests.
 */

import { describe, it, expect } from "vitest";
import {
  classifyComplexity,
  SMALL_BUDGET_TOKENS,
  LARGE_BUDGET_TOKENS,
} from "../core/llm/complexity-classifier.js";

describe("complexity-classifier (E6.T08)", () => {
  it("constants: SMALL=4000, LARGE=32000", () => {
    expect(SMALL_BUDGET_TOKENS).toBe(4000);
    expect(LARGE_BUDGET_TOKENS).toBe(32_000);
  });

  describe("override", () => {
    it("respects explicit operator override regardless of task kind", () => {
      const r = classifyComplexity({ taskKind: "typo-fix", override: "tier2" });
      expect(r.tier).toBe("tier2");
      expect(r.override).toBe(true);
      expect(r.reason).toBe("operator-override");
    });

    it("override beats critical-task default", () => {
      const r = classifyComplexity({ taskKind: "migration", override: "tier1" });
      expect(r.tier).toBe("tier1");
      expect(r.override).toBe(true);
    });
  });

  describe("critical task kinds always Tier 2", () => {
    it("migration → tier2", () => {
      expect(classifyComplexity({ taskKind: "migration" }).tier).toBe("tier2");
    });

    it("security → tier2", () => {
      expect(classifyComplexity({ taskKind: "security" }).tier).toBe("tier2");
    });

    it("schema-change → tier2", () => {
      expect(classifyComplexity({ taskKind: "schema-change" }).tier).toBe("tier2");
    });

    it("criticality=high → tier2 even for non-critical kinds", () => {
      const r = classifyComplexity({ taskKind: "feature", criticality: "high" });
      expect(r.tier).toBe("tier2");
      expect(r.reason).toBe("criticality-high");
    });
  });

  describe("mechanical kinds → Tier 0", () => {
    it("typo-fix", () => {
      expect(classifyComplexity({ taskKind: "typo-fix" }).tier).toBe("tier0");
    });

    it("format-only", () => {
      expect(classifyComplexity({ taskKind: "format-only" }).tier).toBe("tier0");
    });

    it("rename-symbol", () => {
      expect(classifyComplexity({ taskKind: "rename-symbol" }).tier).toBe("tier0");
    });

    it("but criticality=high overrides to tier2", () => {
      const r = classifyComplexity({ taskKind: "typo-fix", criticality: "high" });
      expect(r.tier).toBe("tier2");
    });
  });

  describe("budget-based routing", () => {
    it("large budget → tier2", () => {
      const r = classifyComplexity({ taskKind: "feature", tokenBudget: 50_000 });
      expect(r.tier).toBe("tier2");
      expect(r.reason).toBe("large-token-budget");
    });

    it("medium budget → tier1", () => {
      const r = classifyComplexity({ taskKind: "feature", tokenBudget: 8000 });
      expect(r.tier).toBe("tier1");
      expect(r.reason).toBe("medium-token-budget");
    });

    it("small budget non-mechanical → tier1 fallback (safer than tier0)", () => {
      const r = classifyComplexity({ taskKind: "feature", tokenBudget: 1000 });
      expect(r.tier).toBe("tier1");
    });
  });

  it("unknown taskKind → tier1 fallback", () => {
    const r = classifyComplexity({ taskKind: "unknown", tokenBudget: 500 });
    expect(r.tier).toBe("tier1");
    expect(r.reason).toBe("unknown-task-fallback");
  });
});
