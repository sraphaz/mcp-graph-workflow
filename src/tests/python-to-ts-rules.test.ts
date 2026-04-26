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
 * Schema validation tests for the Python→TS rule data.
 * See ts-to-python-rules.test.ts for rationale.
 */

import { describe, it, expect } from "vitest";
import { PYTHON_TO_TS_RULES } from "../core/translation/rules/python-to-ts-rules.js";
import { RuleSetSchema } from "../core/translation/rules/rule-schema.js";

describe("PYTHON_TO_TS_RULES (rule data invariants)", () => {
  it("should validate against RuleSetSchema (Zod round-trip)", () => {
    const result = RuleSetSchema.safeParse(PYTHON_TO_TS_RULES);
    expect(result.success).toBe(true);
  });

  it("should declare sourceLanguage='python' and targetLanguage='typescript'", () => {
    expect(PYTHON_TO_TS_RULES.sourceLanguage).toBe("python");
    expect(PYTHON_TO_TS_RULES.targetLanguage).toBe("typescript");
  });

  it("should expose a non-empty rules array", () => {
    expect(Array.isArray(PYTHON_TO_TS_RULES.rules)).toBe(true);
    expect(PYTHON_TO_TS_RULES.rules.length).toBeGreaterThan(0);
  });

  it("should have unique rule IDs", () => {
    const ids = PYTHON_TO_TS_RULES.rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have every rule's source/target match the ruleset declaration", () => {
    for (const r of PYTHON_TO_TS_RULES.rules) {
      expect(r.sourceLanguage).toBe("python");
      expect(r.targetLanguage).toBe("typescript");
    }
  });

  it("should have every rule with confidence in [0, 1]", () => {
    for (const r of PYTHON_TO_TS_RULES.rules) {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("should have every rule with a non-empty transformation template", () => {
    for (const r of PYTHON_TO_TS_RULES.rules) {
      expect(r.transformation.template).toBeTruthy();
      expect(r.transformation.template.length).toBeGreaterThan(0);
    }
  });
});
