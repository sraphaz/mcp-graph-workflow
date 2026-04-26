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
import { PresetSchema } from "../schemas/preset.schema.js";

describe("PresetSchema", () => {
  const minimalPreset = { name: "default", description: "Default preset" };

  it("should accept the minimal valid preset", () => {
    expect(PresetSchema.safeParse(minimalPreset).success).toBe(true);
  });

  it("should reject empty name", () => {
    expect(PresetSchema.safeParse({ ...minimalPreset, name: "" }).success).toBe(false);
  });

  it("should reject missing description", () => {
    expect(PresetSchema.safeParse({ name: "x" }).success).toBe(false);
  });

  it("should reject name exceeding 100-char cap", () => {
    expect(
      PresetSchema.safeParse({ ...minimalPreset, name: "x".repeat(101) }).success,
    ).toBe(false);
  });

  it("should accept lifecycle config with valid phases", () => {
    const result = PresetSchema.safeParse({
      ...minimalPreset,
      lifecycle: {
        phases: ["ANALYZE", "IMPLEMENT", "DEPLOY"],
        strictness: "strict",
        codeIntelligence: "advisory",
        prerequisites: "off",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject unknown lifecycle phase", () => {
    expect(
      PresetSchema.safeParse({
        ...minimalPreset,
        lifecycle: { phases: ["TIME_TRAVEL"] },
      }).success,
    ).toBe(false);
  });

  it("should reject invalid strictness value", () => {
    expect(
      PresetSchema.safeParse({
        ...minimalPreset,
        lifecycle: { strictness: "very-strict" },
      }).success,
    ).toBe(false);
  });

  it("should accept extends, tags, templates as optional", () => {
    const result = PresetSchema.safeParse({
      ...minimalPreset,
      extends: "base",
      tags: ["sandbox", "ci"],
      templates: ["mvp", "rapid"],
    });
    expect(result.success).toBe(true);
  });

  it("should accept dod with custom checks", () => {
    const result = PresetSchema.safeParse({
      ...minimalPreset,
      dod: {
        checks: { tests: true, lint: false },
        customChecks: [
          {
            name: "no-todo",
            description: "No TODOs",
            phase: "REVIEW",
            condition: "grep -L TODO",
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });
});
