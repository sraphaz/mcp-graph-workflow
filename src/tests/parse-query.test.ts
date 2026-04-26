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
import { safeParseInt } from "../core/utils/parse-query.js";

describe("safeParseInt", () => {
  it("should return the default value when raw is undefined", () => {
    expect(safeParseInt(undefined, { defaultValue: 10 })).toEqual({ value: 10 });
  });

  it("should return the default value when raw is an empty string (treated as absent)", () => {
    expect(safeParseInt("", { defaultValue: 5 })).toEqual({ value: 5 });
  });

  it("should parse a valid integer string", () => {
    expect(safeParseInt("42", { defaultValue: 0 })).toEqual({ value: 42 });
  });

  it("should return default + error when raw is not a number", () => {
    const result = safeParseInt("abc", { defaultValue: 7 });
    expect(result.value).toBe(7);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/Expected integer/i);
  });

  it("should reject values below the minimum and fall back to default", () => {
    const result = safeParseInt("3", { min: 10, defaultValue: 100 });
    expect(result.value).toBe(100);
    expect(result.error).toMatch(/below minimum 10/);
  });

  it("should reject values above the maximum and fall back to default", () => {
    const result = safeParseInt("999", { max: 50, defaultValue: 1 });
    expect(result.value).toBe(1);
    expect(result.error).toMatch(/exceeds maximum 50/);
  });

  it("should accept the boundary values (min and max are inclusive)", () => {
    expect(safeParseInt("10", { min: 10, max: 20, defaultValue: 0 })).toEqual({ value: 10 });
    expect(safeParseInt("20", { min: 10, max: 20, defaultValue: 0 })).toEqual({ value: 20 });
  });

  it("should NOT report an error for valid in-bounds values", () => {
    const result = safeParseInt("15", { min: 10, max: 20, defaultValue: 0 });
    expect(result.error).toBeUndefined();
    expect(result.value).toBe(15);
  });

  it("should treat decimal strings as integer-valid via parseInt(_, 10)", () => {
    // parseInt("3.7", 10) → 3. Document the behavior so a future change to
    // Number() / strict parsing is intentional.
    expect(safeParseInt("3.7", { defaultValue: 0 })).toEqual({ value: 3 });
  });
});
