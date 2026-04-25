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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { ToolTokenStore } from "../core/store/tool-token-store.js";
import {
  recordToolCallTelemetry,
  classifyError,
  isTelemetryEnabled,
} from "../mcp/unified-gate-telemetry.js";

describe("unified-gate-telemetry — V11 Maestro Phase 1", () => {
  let store: SqliteStore;
  let tokenStore: ToolTokenStore;
  let projectId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    const project = store.initProject("Test Project");
    projectId = project.id;
    tokenStore = new ToolTokenStore(store.getDb());
    delete process.env.MCP_GRAPH_TELEMETRY;
  });

  afterEach(() => {
    store.close();
    delete process.env.MCP_GRAPH_TELEMETRY;
  });

  describe("isTelemetryEnabled", () => {
    it("should be true by default", () => {
      delete process.env.MCP_GRAPH_TELEMETRY;
      expect(isTelemetryEnabled()).toBe(true);
    });

    it("should be false when MCP_GRAPH_TELEMETRY=off", () => {
      process.env.MCP_GRAPH_TELEMETRY = "off";
      expect(isTelemetryEnabled()).toBe(false);
    });

    it("should be true when MCP_GRAPH_TELEMETRY is any other value", () => {
      process.env.MCP_GRAPH_TELEMETRY = "on";
      expect(isTelemetryEnabled()).toBe(true);

      process.env.MCP_GRAPH_TELEMETRY = "";
      expect(isTelemetryEnabled()).toBe(true);
    });
  });

  describe("classifyError", () => {
    it("should return error.name for Error instances", () => {
      expect(classifyError(new TypeError("bad"))).toBe("TypeError");
      expect(classifyError(new RangeError("oops"))).toBe("RangeError");
      expect(classifyError(new Error("plain"))).toBe("Error");
    });

    it("should return 'unknown' for non-Error throws", () => {
      expect(classifyError("string error")).toBe("unknown");
      expect(classifyError(42)).toBe("unknown");
      expect(classifyError(null)).toBe("unknown");
      expect(classifyError(undefined)).toBe("unknown");
    });

    it("should fall back when error.name is empty", () => {
      const e = new Error("no name");
      Object.defineProperty(e, "name", { value: "" });
      expect(classifyError(e)).toBe("Error");
    });
  });

  describe("recordToolCallTelemetry", () => {
    it("should record success=true with durationMs", () => {
      recordToolCallTelemetry(store, "list", 100, 200, true, 47);

      const stats = tokenStore.getUsageStats(projectId);
      expect(stats).toHaveLength(1);
      expect(stats[0].toolName).toBe("list");
      expect(stats[0].callCount).toBe(1);
      expect(stats[0].successRate).toBe(1);
      expect(stats[0].avgDurationMs).toBe(47);
    });

    it("should record success=false with errorKind", () => {
      recordToolCallTelemetry(store, "export", 0, 0, false, 1500, "TimeoutError");

      const stats = tokenStore.getUsageStats(projectId);
      expect(stats).toHaveLength(1);
      expect(stats[0].toolName).toBe("export");
      expect(stats[0].successRate).toBe(0);
    });

    it("should NOT record when MCP_GRAPH_TELEMETRY=off", () => {
      process.env.MCP_GRAPH_TELEMETRY = "off";

      recordToolCallTelemetry(store, "list", 100, 200, true, 47);

      const stats = tokenStore.getUsageStats(projectId);
      expect(stats).toEqual([]);
    });

    it("should NOT record when no project initialized (fail-silent)", () => {
      const noProj = SqliteStore.open(":memory:");
      try {
        // Should not throw — fail-silent
        expect(() => {
          recordToolCallTelemetry(noProj, "list", 100, 200, true, 47);
        }).not.toThrow();
      } finally {
        noProj.close();
      }
    });

    it("should NOT propagate errors when store throws (fail-silent)", () => {
      // Pass a corrupted store proxy that throws on getDb()
      const brokenStore = {
        getProject: () => ({ id: projectId, name: "x" }),
        getDb: () => {
          throw new Error("DB unavailable");
        },
      } as unknown as SqliteStore;

      expect(() => {
        recordToolCallTelemetry(brokenStore, "list", 100, 200, true, 47);
      }).not.toThrow();
    });

    it("should be a no-op (return undefined) — telemetry has no observable side effect for the caller", () => {
      const result = recordToolCallTelemetry(store, "list", 100, 200, true, 47);
      expect(result).toBeUndefined();
    });
  });
});
