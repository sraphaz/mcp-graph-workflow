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

import { describe, it, expect, beforeEach } from "vitest";
import { PluginManifestSchema } from "../schemas/plugin.schema.js";
import { PluginRegistry } from "../core/plugins/plugin-registry.js";
import type { PluginManifest } from "../core/plugins/plugin-registry.js";

describe("Plugin manifest schema", () => {
  it("should validate a complete plugin manifest", () => {
    // Arrange
    const manifest = {
      name: "test-plugin",
      version: "1.0.0",
      description: "A test plugin",
      entryPoint: "./index.js",
      capabilities: ["analyzer", "validator"],
    };

    // Act
    const result = PluginManifestSchema.safeParse(manifest);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("test-plugin");
      expect(result.data.version).toBe("1.0.0");
      expect(result.data.capabilities).toEqual(["analyzer", "validator"]);
    }
  });

  it("should validate manifest with requires and conflicts", () => {
    // Arrange
    const manifest = {
      name: "advanced-plugin",
      version: "2.0.0",
      description: "Plugin with dependencies",
      entryPoint: "./index.js",
      capabilities: ["tool"],
      requires: {
        plugins: ["base-plugin"],
      },
      conflicts: ["legacy-plugin"],
    };

    // Act
    const result = PluginManifestSchema.safeParse(manifest);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requires?.plugins).toEqual(["base-plugin"]);
      expect(result.data.conflicts).toEqual(["legacy-plugin"]);
    }
  });

  it("should reject manifest with empty name", () => {
    // Arrange
    const manifest = {
      name: "",
      version: "1.0.0",
      description: "Bad plugin",
      entryPoint: "./index.js",
      capabilities: ["analyzer"],
    };

    // Act
    const result = PluginManifestSchema.safeParse(manifest);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should reject manifest with invalid version", () => {
    // Arrange
    const manifest = {
      name: "bad-version",
      version: "not-semver",
      description: "Bad version",
      entryPoint: "./index.js",
      capabilities: ["analyzer"],
    };

    // Act
    const result = PluginManifestSchema.safeParse(manifest);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should reject manifest with invalid capability", () => {
    // Arrange
    const manifest = {
      name: "bad-caps",
      version: "1.0.0",
      description: "Bad capabilities",
      entryPoint: "./index.js",
      capabilities: ["nonexistent_capability"],
    };

    // Act
    const result = PluginManifestSchema.safeParse(manifest);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe("register and list", () => {
    it("should register a plugin and list it", () => {
      // Arrange
      const manifest: PluginManifest = {
        name: "test-plugin",
        version: "1.0.0",
        description: "Test",
        entryPoint: "./index.js",
        capabilities: ["analyzer"],
      };

      // Act
      registry.register(manifest);

      // Assert
      const plugins = registry.list();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].manifest.name).toBe("test-plugin");
      expect(plugins[0].status).toBe("enabled");
    });
  });

  describe("conflict detection", () => {
    it("should detect conflicts between plugins", () => {
      // Arrange
      const pluginA: PluginManifest = {
        name: "plugin-a",
        version: "1.0.0",
        description: "Plugin A",
        entryPoint: "./index.js",
        capabilities: ["analyzer"],
        conflicts: ["plugin-b"],
      };
      const pluginB: PluginManifest = {
        name: "plugin-b",
        version: "1.0.0",
        description: "Plugin B",
        entryPoint: "./index.js",
        capabilities: ["validator"],
      };
      registry.register(pluginA);

      // Act & Assert
      expect(() => registry.register(pluginB)).toThrow(/conflict/i);
    });

    it("should detect bidirectional conflicts", () => {
      // Arrange
      const pluginA: PluginManifest = {
        name: "plugin-a",
        version: "1.0.0",
        description: "Plugin A",
        entryPoint: "./index.js",
        capabilities: ["analyzer"],
      };
      const pluginB: PluginManifest = {
        name: "plugin-b",
        version: "1.0.0",
        description: "Plugin B",
        entryPoint: "./index.js",
        capabilities: ["validator"],
        conflicts: ["plugin-a"],
      };
      registry.register(pluginA);

      // Act & Assert
      expect(() => registry.register(pluginB)).toThrow(/conflict/i);
    });
  });

  describe("dependency validation", () => {
    it("should fail when required plugin is not installed", () => {
      // Arrange
      const manifest: PluginManifest = {
        name: "dependent-plugin",
        version: "1.0.0",
        description: "Needs base",
        entryPoint: "./index.js",
        capabilities: ["tool"],
        requires: { plugins: ["base-plugin"] },
      };

      // Act & Assert
      expect(() => registry.register(manifest)).toThrow(/dependency/i);
    });

    it("should succeed when required plugin is installed", () => {
      // Arrange
      const base: PluginManifest = {
        name: "base-plugin",
        version: "1.0.0",
        description: "Base",
        entryPoint: "./index.js",
        capabilities: ["analyzer"],
      };
      const dependent: PluginManifest = {
        name: "dependent-plugin",
        version: "1.0.0",
        description: "Needs base",
        entryPoint: "./index.js",
        capabilities: ["tool"],
        requires: { plugins: ["base-plugin"] },
      };
      registry.register(base);

      // Act
      registry.register(dependent);

      // Assert
      expect(registry.list()).toHaveLength(2);
    });
  });

  describe("enable/disable", () => {
    it("should disable a plugin", () => {
      // Arrange
      const manifest: PluginManifest = {
        name: "test-plugin",
        version: "1.0.0",
        description: "Test",
        entryPoint: "./index.js",
        capabilities: ["analyzer"],
      };
      registry.register(manifest);

      // Act
      registry.disable("test-plugin");

      // Assert
      const plugin = registry.get("test-plugin");
      expect(plugin?.status).toBe("disabled");
    });

    it("should enable a disabled plugin", () => {
      // Arrange
      const manifest: PluginManifest = {
        name: "test-plugin",
        version: "1.0.0",
        description: "Test",
        entryPoint: "./index.js",
        capabilities: ["analyzer"],
      };
      registry.register(manifest);
      registry.disable("test-plugin");

      // Act
      registry.enable("test-plugin");

      // Assert
      const plugin = registry.get("test-plugin");
      expect(plugin?.status).toBe("enabled");
    });
  });

  describe("remove", () => {
    it("should remove a plugin", () => {
      // Arrange
      const manifest: PluginManifest = {
        name: "test-plugin",
        version: "1.0.0",
        description: "Test",
        entryPoint: "./index.js",
        capabilities: ["analyzer"],
      };
      registry.register(manifest);

      // Act
      registry.remove("test-plugin");

      // Assert
      expect(registry.list()).toHaveLength(0);
      expect(registry.get("test-plugin")).toBeUndefined();
    });

    it("should fail to remove plugin with dependents", () => {
      // Arrange
      const base: PluginManifest = {
        name: "base-plugin",
        version: "1.0.0",
        description: "Base",
        entryPoint: "./index.js",
        capabilities: ["analyzer"],
      };
      const dependent: PluginManifest = {
        name: "dependent-plugin",
        version: "1.0.0",
        description: "Needs base",
        entryPoint: "./index.js",
        capabilities: ["tool"],
        requires: { plugins: ["base-plugin"] },
      };
      registry.register(base);
      registry.register(dependent);

      // Act & Assert
      expect(() => registry.remove("base-plugin")).toThrow(/dependent/i);
    });
  });
});
