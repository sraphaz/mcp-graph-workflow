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
 * Shared contract suite for ParserAdapter language-specific tests.
 *
 * Each language adapter test imports this helper and calls
 * `runAdapterContractSuite()` once with a language-specific fixture. The
 * suite enforces 3 contract invariants every adapter MUST satisfy regardless
 * of language:
 *   1. languageId is set and matches expected value
 *   2. parseSnippet("") returns empty array (graceful empty-input handling)
 *   3. parseSnippet(realFixture) returns at least one ParsedConstruct
 *   4. parseSnippet(malformed) does not throw (graceful degradation)
 *
 * The language-specific fixture is what makes each test unique — proving the
 * adapter actually parses THAT language, not just any string.
 */

import { describe, it, expect } from "vitest";
import type { ParserAdapter } from "../../core/translation/parsers/parser-adapter.js";

export interface AdapterFixture {
  /** Class instance under test. */
  adapter: ParserAdapter;
  /** Expected languageId (must match exactly). */
  expectedLanguageId: string;
  /** Realistic snippet in the target language (≥ 1 detectable construct). */
  realCode: string;
  /** Intentionally malformed snippet — adapter must NOT throw on it. */
  malformedCode: string;
}

/**
 * Run the language-agnostic contract suite against a parser adapter.
 *
 * Call once per <lang>-parser-adapter.test.ts file inside a `describe(...)`
 * or at the top level — vitest will register the nested describe.
 */
export function runAdapterContractSuite(fixture: AdapterFixture): void {
  const { adapter, expectedLanguageId, realCode, malformedCode } = fixture;

  describe(`${expectedLanguageId} adapter — ParserAdapter contract`, () => {
    it(`should expose languageId='${expectedLanguageId}'`, () => {
      expect(adapter.languageId).toBe(expectedLanguageId);
    });

    it("should return [] for empty input (no false-positive constructs)", () => {
      const result = adapter.parseSnippet("");
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("should detect at least one construct in realistic source", () => {
      const result = adapter.parseSnippet(realCode);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      // Every entry must have a constructId (canonical UCR identifier).
      for (const c of result) {
        expect(c.constructId).toBeTruthy();
        expect(typeof c.constructId).toBe("string");
      }
    });

    it("should not throw on malformed input (graceful degradation)", () => {
      expect(() => adapter.parseSnippet(malformedCode)).not.toThrow();
    });
  });
}
