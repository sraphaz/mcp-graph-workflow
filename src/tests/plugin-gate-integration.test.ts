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
import {
  PluginToolRegistry,
} from "../core/plugins/plugin-tool-registry.js";

describe("PluginToolRegistry", () => {
  describe("register and list", () => {
    it("should register a plugin-contributed tool", () => {
      // Arrange
      const registry = new PluginToolRegistry();

      // Act
      registry.register({
        toolName: "custom_analyzer",
        pluginName: "security-plugin",
        handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      });

      // Assert
      const tools = registry.list();
      expect(tools).toHaveLength(1);
      expect(tools[0].toolName).toBe("custom_analyzer");
      expect(tools[0].pluginName).toBe("security-plugin");
    });
  });

  describe("isPluginTool", () => {
    it("should identify plugin-contributed tools", () => {
      // Arrange
      const registry = new PluginToolRegistry();
      registry.register({
        toolName: "plugin_tool",
        pluginName: "my-plugin",
        handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      });

      // Act & Assert
      expect(registry.isPluginTool("plugin_tool")).toBe(true);
      expect(registry.isPluginTool("native_tool")).toBe(false);
    });
  });

  describe("getPluginForTool", () => {
    it("should return plugin name for a tool", () => {
      // Arrange
      const registry = new PluginToolRegistry();
      registry.register({
        toolName: "custom_tool",
        pluginName: "test-plugin",
        handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      });

      // Act
      const pluginName = registry.getPluginForTool("custom_tool");

      // Assert
      expect(pluginName).toBe("test-plugin");
    });

    it("should return undefined for native tools", () => {
      const registry = new PluginToolRegistry();
      expect(registry.getPluginForTool("native")).toBeUndefined();
    });
  });

  describe("isPluginEnabled", () => {
    it("should track enabled/disabled state", () => {
      // Arrange
      const registry = new PluginToolRegistry();
      registry.register({
        toolName: "tool_a",
        pluginName: "plugin-a",
        handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      });

      // Act & Assert
      expect(registry.isPluginEnabled("plugin-a")).toBe(true);
      registry.disablePlugin("plugin-a");
      expect(registry.isPluginEnabled("plugin-a")).toBe(false);
      registry.enablePlugin("plugin-a");
      expect(registry.isPluginEnabled("plugin-a")).toBe(true);
    });
  });

  describe("remove", () => {
    it("should remove all tools from a plugin", () => {
      // Arrange
      const registry = new PluginToolRegistry();
      registry.register({ toolName: "tool_1", pluginName: "my-plugin", handler: async () => ({ content: [] }) });
      registry.register({ toolName: "tool_2", pluginName: "my-plugin", handler: async () => ({ content: [] }) });
      registry.register({ toolName: "tool_3", pluginName: "other-plugin", handler: async () => ({ content: [] }) });

      // Act
      registry.removePlugin("my-plugin");

      // Assert
      expect(registry.list()).toHaveLength(1);
      expect(registry.list()[0].pluginName).toBe("other-plugin");
    });
  });

  describe("wrappedTools tracking", () => {
    it("should track which tools have been gate-wrapped", () => {
      // Arrange
      const registry = new PluginToolRegistry();
      registry.register({ toolName: "tool_a", pluginName: "p", handler: async () => ({ content: [] }) });

      // Act & Assert
      expect(registry.isWrapped("tool_a")).toBe(false);
      registry.markWrapped("tool_a");
      expect(registry.isWrapped("tool_a")).toBe(true);
    });

    it("should list unwrapped tools for incremental wrapping", () => {
      // Arrange
      const registry = new PluginToolRegistry();
      registry.register({ toolName: "tool_a", pluginName: "p", handler: async () => ({ content: [] }) });
      registry.register({ toolName: "tool_b", pluginName: "p", handler: async () => ({ content: [] }) });
      registry.markWrapped("tool_a");

      // Act
      const unwrapped = registry.getUnwrappedTools();

      // Assert
      expect(unwrapped).toHaveLength(1);
      expect(unwrapped[0].toolName).toBe("tool_b");
    });
  });
});
