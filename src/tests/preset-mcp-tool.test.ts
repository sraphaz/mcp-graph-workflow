import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  handlePresetList,
  handlePresetApply,
  handlePresetShow,
  handlePresetCreate,
} from "../mcp/tools/preset.js";

describe("Preset MCP tool handlers", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  describe("handlePresetList", () => {
    it("should list all built-in presets", () => {
      // Arrange & Act
      const result = handlePresetList(store);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.presets.length).toBeGreaterThanOrEqual(4);
      const names = result.presets.map((p: { name: string }) => p.name);
      expect(names).toContain("default");
      expect(names).toContain("strict-tdd");
      expect(names).toContain("agile-light");
      expect(names).toContain("enterprise");
    });
  });

  describe("handlePresetApply", () => {
    it("should apply a built-in preset and persist setting", () => {
      // Arrange & Act
      const result = handlePresetApply(store, { presetName: "strict-tdd" });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.applied).toBe("strict-tdd");
    });

    it("should reject unknown preset name", () => {
      // Arrange & Act
      const result = handlePresetApply(store, { presetName: "nonexistent" });

      // Assert
      expect(result.ok).toBe(false);
    });
  });

  describe("handlePresetShow", () => {
    it("should show resolved config with source annotations", () => {
      // Arrange
      handlePresetApply(store, { presetName: "strict-tdd" });

      // Act
      const result = handlePresetShow(store);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.config.strictness.value).toBe("strict");
      expect(result.config.strictness.source).toContain("strict-tdd");
      expect(result.config.port.value).toBe(3000);
      expect(result.config.port.source).toBe("default");
    });

    it("should show defaults when no preset applied", () => {
      // Arrange & Act
      const result = handlePresetShow(store);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.config.strictness.value).toBe("advisory");
      expect(result.config.strictness.source).toBe("default");
    });
  });

  describe("handlePresetCreate", () => {
    it("should create and persist a custom preset", () => {
      // Arrange & Act
      const result = handlePresetCreate(store, {
        name: "my-custom",
        description: "Custom project preset",
        lifecycle: { strictness: "strict", phases: ["ANALYZE", "IMPLEMENT", "VALIDATE"] },
      });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.created).toBe("my-custom");
    });

    it("should be listable after creation", () => {
      // Arrange
      handlePresetCreate(store, {
        name: "team-preset",
        description: "Team workflow",
        lifecycle: { strictness: "advisory" },
      });

      // Act
      const list = handlePresetList(store);

      // Assert
      const names = list.presets.map((p: { name: string }) => p.name);
      expect(names).toContain("team-preset");
    });
  });
});
