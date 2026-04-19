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
  HookSystem,
  type HookPoint,
  type HookContext,
} from "../core/plugins/hook-system.js";

describe("HookSystem", () => {
  describe("registerHook and execute", () => {
    it("should execute registered hook when triggered", async () => {
      // Arrange
      const system = new HookSystem();
      const handler = vi.fn();
      system.registerHook({ pluginName: "test", hookPoint: "on:node_created", priority: 10, handler });

      // Act
      await system.executeHooks("on:node_created", { nodeId: "n1", title: "Test" });

      // Assert
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].data.nodeId).toBe("n1");
    });

    it("should execute hooks in priority order (lower first)", async () => {
      // Arrange
      const system = new HookSystem();
      const order: string[] = [];
      system.registerHook({ pluginName: "b", hookPoint: "on:node_updated", priority: 20, handler: () => { order.push("b"); } });
      system.registerHook({ pluginName: "a", hookPoint: "on:node_updated", priority: 5, handler: () => { order.push("a"); } });
      system.registerHook({ pluginName: "c", hookPoint: "on:node_updated", priority: 10, handler: () => { order.push("c"); } });

      // Act
      await system.executeHooks("on:node_updated", {});

      // Assert
      expect(order).toEqual(["a", "c", "b"]);
    });
  });

  describe("abort on before: hooks", () => {
    it("should allow abort() on before: hooks", async () => {
      // Arrange
      const system = new HookSystem();
      system.registerHook({
        pluginName: "blocker",
        hookPoint: "before:tool_call",
        priority: 1,
        handler: (ctx: HookContext) => { ctx.abort("Blocked by policy"); },
      });

      // Act
      const result = await system.executeHooks("before:tool_call", { toolName: "import_prd" });

      // Assert
      expect(result.aborted).toBe(true);
      expect(result.abortReason).toBe("Blocked by policy");
    });

    it("should NOT allow abort() on on: hooks", async () => {
      // Arrange
      const system = new HookSystem();
      system.registerHook({
        pluginName: "watcher",
        hookPoint: "on:node_created",
        priority: 1,
        handler: (ctx: HookContext) => { ctx.abort("Should be ignored"); },
      });

      // Act
      const result = await system.executeHooks("on:node_created", {});

      // Assert
      expect(result.aborted).toBe(false);
    });
  });

  describe("error boundary", () => {
    it("should catch handler errors and continue executing other hooks", async () => {
      // Arrange
      const system = new HookSystem();
      const secondHandler = vi.fn();

      system.registerHook({
        pluginName: "crasher",
        hookPoint: "on:node_created",
        priority: 1,
        handler: () => { throw new Error("Hook crashed!"); },
      });
      system.registerHook({
        pluginName: "survivor",
        hookPoint: "on:node_created",
        priority: 2,
        handler: secondHandler,
      });

      // Act
      const result = await system.executeHooks("on:node_created", {});

      // Assert
      expect(secondHandler).toHaveBeenCalledOnce(); // continues despite crash
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Hook crashed!");
    });
  });

  describe("hook points", () => {
    it("should support all defined hook points", async () => {
      const system = new HookSystem();
      const points: HookPoint[] = [
        "before:tool_call", "after:tool_call",
        "before:phase_transition", "after:phase_transition",
        "on:node_created", "on:node_updated",
        "on:spec_changed", "on:constitution_violated",
      ];

      for (const point of points) {
        const handler = vi.fn();
        system.registerHook({ pluginName: "test", hookPoint: point, priority: 1, handler });
        await system.executeHooks(point, {});
        expect(handler).toHaveBeenCalledOnce();
      }
    });
  });

  describe("removeHooks", () => {
    it("should remove all hooks for a plugin", async () => {
      // Arrange
      const system = new HookSystem();
      const handler = vi.fn();
      system.registerHook({ pluginName: "removable", hookPoint: "on:node_created", priority: 1, handler });

      // Act
      system.removeHooks("removable");
      await system.executeHooks("on:node_created", {});

      // Assert
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
