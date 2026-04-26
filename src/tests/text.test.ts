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

import { describe, it, expect } from "vitest";
import { normalizeNewlines } from "../core/utils/text.js";

describe("normalizeNewlines", () => {
  it("should pass through undefined", () => {
    expect(normalizeNewlines(undefined)).toBeUndefined();
  });

  it("should pass through empty string", () => {
    // Falsy guard returns the input unchanged.
    expect(normalizeNewlines("")).toBe("");
  });

  it("should convert literal '\\n' (backslash-n) to real newlines", () => {
    expect(normalizeNewlines("line1\\nline2")).toBe("line1\nline2");
  });

  it("should convert multiple occurrences across the string", () => {
    expect(normalizeNewlines("a\\nb\\nc\\nd")).toBe("a\nb\nc\nd");
  });

  it("should preserve real newlines when present", () => {
    expect(normalizeNewlines("a\nb")).toBe("a\nb");
  });

  it("should not alter strings without escaped sequences", () => {
    expect(normalizeNewlines("hello world")).toBe("hello world");
  });

  it("should not interpret other escape sequences (\\t, \\r)", () => {
    // Function targets \\n specifically — \\t stays literal.
    expect(normalizeNewlines("a\\tb")).toBe("a\\tb");
  });
});
