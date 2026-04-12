import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  handlePluginInstall,
  handlePluginRemove,
  handlePluginEnable,
  handlePluginDisable,
  handlePluginList,
  handlePluginInfo,
} from "../mcp/tools/plugin.js";

describe("Plugin MCP tool handlers", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  describe("handlePluginInstall", () => {
    it("should install a plugin and persist it", () => {
      // Arrange & Act
      const result = handlePluginInstall(store, {
        name: "test-plugin",
        version: "1.0.0",
        description: "A test plugin",
        entryPoint: "./index.js",
        capabilities: ["analyzer"],
        path: "/plugins/test-plugin",
      });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.name).toBe("test-plugin");
      expect(result.status).toBe("installed");
    });
  });

  describe("handlePluginRemove", () => {
    it("should remove an installed plugin", () => {
      // Arrange
      handlePluginInstall(store, {
        name: "test-plugin",
        version: "1.0.0",
        description: "Test",
        entryPoint: "./index.js",
        capabilities: ["analyzer"],
        path: "/plugins/test",
      });

      // Act
      const result = handlePluginRemove(store, { name: "test-plugin" });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.removed).toBe("test-plugin");
    });
  });

  describe("handlePluginEnable / handlePluginDisable", () => {
    it("should disable then enable a plugin", () => {
      // Arrange
      handlePluginInstall(store, {
        name: "toggle-plugin",
        version: "1.0.0",
        description: "Toggle",
        entryPoint: "./index.js",
        capabilities: ["tool"],
        path: "/plugins/toggle",
      });

      // Act — disable
      const disabled = handlePluginDisable(store, { name: "toggle-plugin" });
      expect(disabled.ok).toBe(true);
      expect(disabled.status).toBe("disabled");

      // Act — enable
      const enabled = handlePluginEnable(store, { name: "toggle-plugin" });
      expect(enabled.ok).toBe(true);
      expect(enabled.status).toBe("enabled");
    });
  });

  describe("handlePluginList", () => {
    it("should list all installed plugins with status", () => {
      // Arrange
      handlePluginInstall(store, { name: "plugin-a", version: "1.0.0", description: "A", entryPoint: "./a.js", capabilities: ["analyzer"], path: "/a" });
      handlePluginInstall(store, { name: "plugin-b", version: "2.0.0", description: "B", entryPoint: "./b.js", capabilities: ["tool"], path: "/b" });

      // Act
      const result = handlePluginList(store);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.plugins).toHaveLength(2);
      expect(result.plugins[0].name).toBe("plugin-a");
      expect(result.plugins[1].name).toBe("plugin-b");
    });

    it("should return empty list when no plugins", () => {
      const result = handlePluginList(store);
      expect(result.ok).toBe(true);
      expect(result.plugins).toHaveLength(0);
    });
  });

  describe("handlePluginInfo", () => {
    it("should return full plugin details", () => {
      // Arrange
      handlePluginInstall(store, {
        name: "info-plugin",
        version: "3.1.0",
        description: "Plugin with details",
        entryPoint: "./index.js",
        capabilities: ["analyzer", "validator"],
        path: "/plugins/info",
      });

      // Act
      const result = handlePluginInfo(store, { name: "info-plugin" });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.plugin?.name).toBe("info-plugin");
      expect(result.plugin?.version).toBe("3.1.0");
      expect(result.plugin?.path).toBe("/plugins/info");
    });

    it("should return not found for missing plugin", () => {
      const result = handlePluginInfo(store, { name: "nonexistent" });
      expect(result.ok).toBe(false);
    });
  });
});
