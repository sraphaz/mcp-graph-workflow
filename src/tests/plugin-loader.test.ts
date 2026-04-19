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

import { describe, it, expect, vi } from "vitest";
import {
  PluginLoader,
  resolveLoadOrder,
  type PluginInstance,
} from "../core/plugins/plugin-loader.js";
import { PluginRegistry } from "../core/plugins/plugin-registry.js";
import type { PluginManifest } from "../core/plugins/plugin-registry.js";

describe("resolveLoadOrder (topological sort)", () => {
  it("should return manifests in dependency order", () => {
    // Arrange
    const a: PluginManifest = { name: "a", version: "1.0.0", description: "A", entryPoint: "./a.js", capabilities: ["analyzer"] };
    const b: PluginManifest = { name: "b", version: "1.0.0", description: "B", entryPoint: "./b.js", capabilities: ["tool"], requires: { plugins: ["a"] } };
    const c: PluginManifest = { name: "c", version: "1.0.0", description: "C", entryPoint: "./c.js", capabilities: ["validator"], requires: { plugins: ["b"] } };

    // Act
    const order = resolveLoadOrder([c, a, b]);

    // Assert
    const names = order.map((m) => m.name);
    expect(names.indexOf("a")).toBeLessThan(names.indexOf("b"));
    expect(names.indexOf("b")).toBeLessThan(names.indexOf("c"));
  });

  it("should handle manifests with no dependencies", () => {
    // Arrange
    const a: PluginManifest = { name: "a", version: "1.0.0", description: "A", entryPoint: "./a.js", capabilities: ["analyzer"] };
    const b: PluginManifest = { name: "b", version: "1.0.0", description: "B", entryPoint: "./b.js", capabilities: ["tool"] };

    // Act
    const order = resolveLoadOrder([b, a]);

    // Assert
    expect(order).toHaveLength(2);
  });

  it("should detect circular dependencies", () => {
    // Arrange
    const a: PluginManifest = { name: "a", version: "1.0.0", description: "A", entryPoint: "./a.js", capabilities: ["analyzer"], requires: { plugins: ["b"] } };
    const b: PluginManifest = { name: "b", version: "1.0.0", description: "B", entryPoint: "./b.js", capabilities: ["tool"], requires: { plugins: ["a"] } };

    // Act & Assert
    expect(() => resolveLoadOrder([a, b])).toThrow(/circular/i);
  });
});

describe("PluginLoader", () => {
  it("should activate plugin with PluginContext", async () => {
    // Arrange
    const activateFn = vi.fn();
    const mockPlugin: PluginInstance = { activate: activateFn };
    const registry = new PluginRegistry();
    const loader = new PluginLoader(registry);

    const manifest: PluginManifest = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Test",
      entryPoint: "./index.js",
      capabilities: ["analyzer"],
    };

    // Act
    await loader.loadPlugin(manifest, mockPlugin);

    // Assert
    expect(activateFn).toHaveBeenCalledOnce();
    expect(activateFn.mock.calls[0][0]).toHaveProperty("registerTool");
    expect(activateFn.mock.calls[0][0]).toHaveProperty("registerAnalyzer");
    expect(registry.get("test-plugin")?.status).toBe("enabled");
  });

  it("should catch errors in activate() and set status to error", async () => {
    // Arrange
    const badPlugin: PluginInstance = {
      activate: () => { throw new Error("Plugin crashed!"); },
    };
    const registry = new PluginRegistry();
    const loader = new PluginLoader(registry);

    const manifest: PluginManifest = {
      name: "bad-plugin",
      version: "1.0.0",
      description: "Crashes",
      entryPoint: "./index.js",
      capabilities: ["tool"],
    };

    // Act
    await loader.loadPlugin(manifest, badPlugin);

    // Assert
    expect(registry.get("bad-plugin")?.status).toBe("error");
    expect(registry.get("bad-plugin")?.error).toContain("Plugin crashed!");
  });

  it("should call deactivate() on unload", async () => {
    // Arrange
    const deactivateFn = vi.fn();
    const mockPlugin: PluginInstance = {
      activate: vi.fn(),
      deactivate: deactivateFn,
    };
    const registry = new PluginRegistry();
    const loader = new PluginLoader(registry);

    const manifest: PluginManifest = {
      name: "deactivatable-plugin",
      version: "1.0.0",
      description: "Has deactivate",
      entryPoint: "./index.js",
      capabilities: ["analyzer"],
    };

    await loader.loadPlugin(manifest, mockPlugin);

    // Act
    await loader.unloadPlugin("deactivatable-plugin");

    // Assert
    expect(deactivateFn).toHaveBeenCalledOnce();
    expect(registry.get("deactivatable-plugin")).toBeUndefined();
  });

  it("should load multiple plugins in dependency order", async () => {
    // Arrange
    const loadOrder: string[] = [];
    const createPlugin = (name: string): PluginInstance => ({
      activate: () => { loadOrder.push(name); },
    });

    const registry = new PluginRegistry();
    const loader = new PluginLoader(registry);

    const manifestA: PluginManifest = { name: "a", version: "1.0.0", description: "A", entryPoint: "./a.js", capabilities: ["analyzer"] };
    const manifestB: PluginManifest = { name: "b", version: "1.0.0", description: "B", entryPoint: "./b.js", capabilities: ["tool"], requires: { plugins: ["a"] } };

    const plugins = new Map<string, PluginInstance>([
      ["a", createPlugin("a")],
      ["b", createPlugin("b")],
    ]);

    // Act
    await loader.loadPlugins([manifestB, manifestA], plugins);

    // Assert
    expect(loadOrder).toEqual(["a", "b"]);
  });
});
