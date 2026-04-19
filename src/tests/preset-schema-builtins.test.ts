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
import {
  BUILT_IN_PRESETS,
  getPreset,
  resolvePresetInheritance,
} from "../core/presets/built-in-presets.js";
import type { PresetDefinition } from "../schemas/preset.schema.js";

describe("PresetSchema validation", () => {
  it("should validate a complete preset with all fields", () => {
    // Arrange
    const preset: PresetDefinition = {
      name: "test-preset",
      description: "A test preset",
      lifecycle: {
        phases: ["ANALYZE", "PLAN", "IMPLEMENT", "VALIDATE"],
        strictness: "strict",
        codeIntelligence: "strict",
        prerequisites: "strict",
      },
      dod: {
        checks: {
          has_acceptance_criteria: true,
          ac_quality_pass: true,
          has_test_files: false,
        },
      },
      classifierPatterns: {
        requirement: ["must have", "shall"],
        constraint: ["cannot exceed"],
      },
      templates: ["prd-template"],
    };

    // Act
    const result = PresetSchema.safeParse(preset);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should validate a minimal preset", () => {
    // Arrange
    const preset = {
      name: "minimal",
      description: "Minimal preset",
    };

    // Act
    const result = PresetSchema.safeParse(preset);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should validate preset with extends field", () => {
    // Arrange
    const preset = {
      name: "child-preset",
      description: "Extends default",
      extends: "default",
      lifecycle: {
        strictness: "advisory",
      },
    };

    // Act
    const result = PresetSchema.safeParse(preset);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.extends).toBe("default");
    }
  });

  it("should reject preset with empty name", () => {
    // Arrange
    const preset = {
      name: "",
      description: "Bad name",
    };

    // Act
    const result = PresetSchema.safeParse(preset);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("Built-in presets", () => {
  it("should have 4 built-in presets", () => {
    expect(BUILT_IN_PRESETS).toHaveLength(4);
  });

  describe("default preset", () => {
    it("should have advisory strictness", () => {
      const preset = getPreset("default");
      expect(preset).toBeDefined();
      expect(preset!.lifecycle?.strictness).toBe("advisory");
    });

    it("should include all 9 lifecycle phases", () => {
      const preset = getPreset("default");
      expect(preset!.lifecycle?.phases).toHaveLength(9);
    });
  });

  describe("strict-tdd preset", () => {
    it("should have all strict modes", () => {
      const preset = getPreset("strict-tdd");
      expect(preset).toBeDefined();
      expect(preset!.lifecycle?.strictness).toBe("strict");
      expect(preset!.lifecycle?.codeIntelligence).toBe("strict");
      expect(preset!.lifecycle?.prerequisites).toBe("strict");
    });

    it("should require AC in DoD checks", () => {
      const preset = getPreset("strict-tdd");
      expect(preset!.dod?.checks?.has_acceptance_criteria).toBe(true);
      expect(preset!.dod?.checks?.ac_quality_pass).toBe(true);
      expect(preset!.dod?.checks?.has_test_files).toBe(true);
    });
  });

  describe("agile-light preset", () => {
    it("should skip DESIGN phase", () => {
      const preset = getPreset("agile-light");
      expect(preset).toBeDefined();
      expect(preset!.lifecycle?.phases).not.toContain("DESIGN");
    });

    it("should have advisory strictness", () => {
      const preset = getPreset("agile-light");
      expect(preset!.lifecycle?.strictness).toBe("advisory");
    });
  });

  describe("enterprise preset", () => {
    it("should include all 9 phases", () => {
      const preset = getPreset("enterprise");
      expect(preset).toBeDefined();
      expect(preset!.lifecycle?.phases).toHaveLength(9);
    });

    it("should require constitution check", () => {
      const preset = getPreset("enterprise");
      expect(preset!.dod?.checks?.constitution_check).toBe(true);
    });

    it("should have strict modes", () => {
      const preset = getPreset("enterprise");
      expect(preset!.lifecycle?.strictness).toBe("strict");
    });
  });

  describe("all built-in presets validate against schema", () => {
    it("should all pass PresetSchema validation", () => {
      for (const preset of BUILT_IN_PRESETS) {
        const result = PresetSchema.safeParse(preset);
        expect(result.success, `Preset "${preset.name}" failed validation`).toBe(true);
      }
    });
  });
});

describe("Preset inheritance (extends)", () => {
  it("should inherit parent settings and override specified fields", () => {
    // Arrange
    const child: PresetDefinition = {
      name: "custom",
      description: "Custom preset",
      extends: "default",
      lifecycle: {
        strictness: "strict",
      },
    };

    // Act
    const resolved = resolvePresetInheritance(child, BUILT_IN_PRESETS);

    // Assert
    expect(resolved.lifecycle?.strictness).toBe("strict"); // overridden
    expect(resolved.lifecycle?.phases).toHaveLength(9); // inherited from default
  });

  it("should return unchanged preset when no extends field", () => {
    // Arrange
    const preset: PresetDefinition = {
      name: "standalone",
      description: "No parent",
      lifecycle: { strictness: "advisory" },
    };

    // Act
    const resolved = resolvePresetInheritance(preset, BUILT_IN_PRESETS);

    // Assert
    expect(resolved.lifecycle?.strictness).toBe("advisory");
    expect(resolved.lifecycle?.phases).toBeUndefined();
  });
});
