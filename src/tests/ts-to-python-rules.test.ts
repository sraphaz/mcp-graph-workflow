/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Schema validation tests for the TS→Python rule data.
 *
 * Rule application is exercised end-to-end by the translation orchestrator
 * tests; this file pins invariants of the static rule table itself: every
 * rule round-trips through the Zod schema, IDs are unique, and the source/
 * target languages match the file's intent.
 */

import { describe, it, expect } from "vitest";
import { TS_TO_PYTHON_RULES } from "../core/translation/rules/ts-to-python-rules.js";
import { RuleSetSchema } from "../core/translation/rules/rule-schema.js";

describe("TS_TO_PYTHON_RULES (rule data invariants)", () => {
  it("should validate against RuleSetSchema (Zod round-trip)", () => {
    const result = RuleSetSchema.safeParse(TS_TO_PYTHON_RULES);
    expect(result.success).toBe(true);
  });

  it("should declare sourceLanguage='typescript' and targetLanguage='python'", () => {
    expect(TS_TO_PYTHON_RULES.sourceLanguage).toBe("typescript");
    expect(TS_TO_PYTHON_RULES.targetLanguage).toBe("python");
  });

  it("should expose a non-empty rules array", () => {
    expect(Array.isArray(TS_TO_PYTHON_RULES.rules)).toBe(true);
    expect(TS_TO_PYTHON_RULES.rules.length).toBeGreaterThan(0);
  });

  it("should have unique rule IDs (no accidental duplicates)", () => {
    const ids = TS_TO_PYTHON_RULES.rules.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("should have every rule's source/target match the ruleset declaration", () => {
    for (const r of TS_TO_PYTHON_RULES.rules) {
      expect(r.sourceLanguage).toBe("typescript");
      expect(r.targetLanguage).toBe("python");
    }
  });

  it("should have every rule with confidence in [0, 1]", () => {
    for (const r of TS_TO_PYTHON_RULES.rules) {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("should cover the canonical control-flow constructs (if/for/while)", () => {
    const irNodeTypes = TS_TO_PYTHON_RULES.rules.map((r) => r.irNodeType);
    expect(irNodeTypes).toContain("IfStatement");
    expect(irNodeTypes).toContain("ForLoop");
    expect(irNodeTypes).toContain("WhileLoop");
  });

  it("should have every rule with a non-empty transformation template", () => {
    for (const r of TS_TO_PYTHON_RULES.rules) {
      expect(r.transformation.template).toBeTruthy();
      expect(r.transformation.template.length).toBeGreaterThan(0);
    }
  });
});
