import { describe, it, expect } from "vitest";
import {
  resolvePresets,
} from "../core/presets/preset-resolver.js";
import type { PresetDefinition } from "../schemas/preset.schema.js";

describe("Preset resolver", () => {
  describe("resolvePresets", () => {
    it("should return defaults when no preset or overrides", () => {
      // Arrange & Act
      const resolved = resolvePresets({ activePreset: undefined, pluginPresets: [], projectOverrides: {} });

      // Assert
      expect(resolved.strictness.value).toBe("advisory");
      expect(resolved.strictness.source).toBe("default");
      expect(resolved.port.value).toBe(3000);
    });

    it("should apply built-in preset over defaults", () => {
      // Arrange & Act
      const resolved = resolvePresets({ activePreset: "strict-tdd", pluginPresets: [], projectOverrides: {} });

      // Assert
      expect(resolved.strictness.value).toBe("strict");
      expect(resolved.strictness.source).toBe("preset:strict-tdd");
      expect(resolved.codeIntelligence.value).toBe("strict");
      expect(resolved.prerequisites.value).toBe("strict");
      expect(resolved.port.value).toBe(3000); // still from defaults
      expect(resolved.port.source).toBe("default");
    });

    it("should apply project overrides over preset", () => {
      // Arrange & Act
      const resolved = resolvePresets({
        activePreset: "strict-tdd",
        pluginPresets: [],
        projectOverrides: { strictness: "advisory" },
      });

      // Assert
      expect(resolved.strictness.value).toBe("advisory");
      expect(resolved.strictness.source).toBe("project");
    });

    it("should apply plugin presets in priority order", () => {
      // Arrange
      const pluginA: PresetDefinition = {
        name: "plugin-a-preset",
        description: "Low priority plugin",
        lifecycle: { strictness: "advisory" },
      };
      const pluginB: PresetDefinition = {
        name: "plugin-b-preset",
        description: "High priority plugin",
        lifecycle: { strictness: "strict" },
      };

      // Act — pluginB listed last = higher priority
      const resolved = resolvePresets({
        activePreset: "default",
        pluginPresets: [pluginA, pluginB],
        projectOverrides: {},
      });

      // Assert
      expect(resolved.strictness.value).toBe("strict");
      expect(resolved.strictness.source).toBe("plugin:plugin-b-preset");
    });

    it("should merge classifierPatterns additively", () => {
      // Arrange
      const plugin: PresetDefinition = {
        name: "custom-patterns",
        description: "Adds patterns",
        classifierPatterns: {
          requirement: ["shall", "must provide"],
        },
      };

      // Act
      const resolved = resolvePresets({
        activePreset: "default",
        pluginPresets: [plugin],
        projectOverrides: {},
      });

      // Assert
      expect(resolved.classifierPatterns.value.requirement).toContain("shall");
      expect(resolved.classifierPatterns.value.requirement).toContain("must provide");
    });

    it("should merge dodChecks additively", () => {
      // Arrange
      const plugin: PresetDefinition = {
        name: "security-plugin",
        description: "Adds security check",
        dod: {
          checks: { security_review: true },
        },
      };

      // Act
      const resolved = resolvePresets({
        activePreset: "default",
        pluginPresets: [plugin],
        projectOverrides: {},
      });

      // Assert
      expect(resolved.dodChecks.value.security_review).toBe(true);
      expect(resolved.dodChecks.value.has_acceptance_criteria).toBe(true); // from default preset
    });

    it("should track source for every field", () => {
      // Arrange & Act
      const resolved = resolvePresets({
        activePreset: "strict-tdd",
        pluginPresets: [],
        projectOverrides: { strictness: "advisory" },
      });

      // Assert — each field has source annotation
      expect(resolved.port.source).toBe("default");
      expect(resolved.strictness.source).toBe("project");
      expect(resolved.codeIntelligence.source).toBe("preset:strict-tdd");
      expect(resolved.phases.source).toBe("preset:strict-tdd");
    });

    it("should handle agile-light preset skipping DESIGN", () => {
      // Arrange & Act
      const resolved = resolvePresets({ activePreset: "agile-light", pluginPresets: [], projectOverrides: {} });

      // Assert
      expect(resolved.phases.value).not.toContain("DESIGN");
      expect(resolved.phases.value).toContain("IMPLEMENT");
    });
  });
});
