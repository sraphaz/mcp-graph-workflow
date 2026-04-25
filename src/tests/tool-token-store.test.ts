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

describe("ToolTokenStore", () => {
  let sqliteStore: SqliteStore;
  let tokenStore: ToolTokenStore;
  let projectId: string;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    const project = sqliteStore.initProject("Test Project");
    projectId = project.id;
    tokenStore = new ToolTokenStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  describe("record", () => {
    it("should record and retrieve a tool token entry", () => {
      tokenStore.record(projectId, "list", 120, 350);

      const recent = tokenStore.getRecentCalls(projectId, 10);
      expect(recent).toHaveLength(1);
      expect(recent[0].toolName).toBe("list");
      expect(recent[0].inputTokens).toBe(120);
      expect(recent[0].outputTokens).toBe(350);
      expect(recent[0].projectId).toBe(projectId);
      expect(recent[0].calledAt).toBeTruthy();
    });
  });

  describe("getPerToolStats", () => {
    it("should compute per-tool aggregates correctly", () => {
      tokenStore.record(projectId, "list", 100, 200);
      tokenStore.record(projectId, "list", 150, 300);
      tokenStore.record(projectId, "context", 500, 1000);

      const stats = tokenStore.getPerToolStats(projectId);
      expect(stats).toHaveLength(2);

      const listStats = stats.find((s) => s.toolName === "list")!;
      expect(listStats.callCount).toBe(2);
      expect(listStats.totalInputTokens).toBe(250);
      expect(listStats.totalOutputTokens).toBe(500);
      expect(listStats.avgInputTokens).toBe(125);
      expect(listStats.avgOutputTokens).toBe(250);
      expect(listStats.totalTokens).toBe(750);

      const ctxStats = stats.find((s) => s.toolName === "context")!;
      expect(ctxStats.callCount).toBe(1);
      expect(ctxStats.totalTokens).toBe(1500);
    });

    it("should compute correct averages with multiple calls", () => {
      tokenStore.record(projectId, "next", 10, 20);
      tokenStore.record(projectId, "next", 30, 40);
      tokenStore.record(projectId, "next", 50, 60);

      const stats = tokenStore.getPerToolStats(projectId);
      const nextStats = stats.find((s) => s.toolName === "next")!;
      expect(nextStats.avgInputTokens).toBe(30);
      expect(nextStats.avgOutputTokens).toBe(40);
    });
  });

  describe("getRecentCalls", () => {
    it("should return recent calls in descending order", () => {
      tokenStore.record(projectId, "list", 100, 200);
      tokenStore.record(projectId, "context", 500, 1000);
      tokenStore.record(projectId, "next", 50, 100);

      const recent = tokenStore.getRecentCalls(projectId, 10);
      expect(recent).toHaveLength(3);
      // Most recent first
      expect(recent[0].toolName).toBe("next");
      expect(recent[2].toolName).toBe("list");
    });
  });

  describe("getSummary", () => {
    it("should handle empty project", () => {
      const summary = tokenStore.getSummary(projectId);
      expect(summary.totalCalls).toBe(0);
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
      expect(summary.perTool).toHaveLength(0);
      expect(summary.recentCalls).toHaveLength(0);
    });

    it("should return complete summary with data", () => {
      tokenStore.record(projectId, "list", 100, 200);
      tokenStore.record(projectId, "list", 150, 300);
      tokenStore.record(projectId, "context", 500, 1000);

      const summary = tokenStore.getSummary(projectId);
      expect(summary.totalCalls).toBe(3);
      expect(summary.totalInputTokens).toBe(750);
      expect(summary.totalOutputTokens).toBe(1500);
      expect(summary.perTool).toHaveLength(2);
      expect(summary.recentCalls).toHaveLength(3);
    });
  });

  describe("project isolation", () => {
    it("should separate data by project_id", () => {
      const project2 = sqliteStore.initProject("Other Project");
      const otherProjectId = project2.id;

      tokenStore.record(projectId, "list", 100, 200);
      tokenStore.record(otherProjectId, "context", 500, 1000);

      const summary1 = tokenStore.getSummary(projectId);
      expect(summary1.totalCalls).toBe(1);
      expect(summary1.perTool[0].toolName).toBe("list");

      const summary2 = tokenStore.getSummary(otherProjectId);
      expect(summary2.totalCalls).toBe(1);
      expect(summary2.perTool[0].toolName).toBe("context");
    });
  });

  describe("clearProject", () => {
    it("should clear all data for a project", () => {
      tokenStore.record(projectId, "list", 100, 200);
      tokenStore.record(projectId, "context", 500, 1000);

      tokenStore.clearProject(projectId);

      const summary = tokenStore.getSummary(projectId);
      expect(summary.totalCalls).toBe(0);
    });
  });

  describe("recordCall (V11 Maestro telemetry)", () => {
    it("should record success, durationMs, and errorKind", () => {
      tokenStore.recordCall(projectId, "analyze", {
        inputTokens: 500,
        outputTokens: 1200,
        success: true,
        durationMs: 247,
      });

      const stats = tokenStore.getUsageStats(projectId);
      expect(stats).toHaveLength(1);
      expect(stats[0].toolName).toBe("analyze");
      expect(stats[0].callCount).toBe(1);
      expect(stats[0].successRate).toBe(1);
      expect(stats[0].avgDurationMs).toBe(247);
    });

    it("should record errorKind for failed calls", () => {
      tokenStore.recordCall(projectId, "export", {
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        durationMs: 1500,
        errorKind: "timeout",
      });

      const stats = tokenStore.getUsageStats(projectId);
      expect(stats[0].successRate).toBe(0);
      expect(stats[0].avgDurationMs).toBe(1500);
    });
  });

  describe("getUsageStats (V11 Maestro telemetry)", () => {
    it("should compute successRate correctly across mixed calls", () => {
      // 3 successes, 2 failures = 0.6 successRate
      tokenStore.recordCall(projectId, "list", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 50 });
      tokenStore.recordCall(projectId, "list", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 60 });
      tokenStore.recordCall(projectId, "list", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 70 });
      tokenStore.recordCall(projectId, "list", { inputTokens: 0, outputTokens: 0, success: false, durationMs: 100, errorKind: "validation" });
      tokenStore.recordCall(projectId, "list", { inputTokens: 0, outputTokens: 0, success: false, durationMs: 200, errorKind: "timeout" });

      const stats = tokenStore.getUsageStats(projectId);
      expect(stats).toHaveLength(1);
      expect(stats[0].callCount).toBe(5);
      expect(stats[0].successRate).toBeCloseTo(0.6, 2);
    });

    it("should compute avgDurationMs and p95DurationMs", () => {
      // 20 calls with durations 100..2000 — p95 should be around 1900
      for (let i = 1; i <= 20; i++) {
        tokenStore.recordCall(projectId, "context", {
          inputTokens: 10,
          outputTokens: 20,
          success: true,
          durationMs: i * 100,
        });
      }

      const stats = tokenStore.getUsageStats(projectId);
      expect(stats[0].avgDurationMs).toBe(1050); // (100+200+...+2000)/20 = 1050
      // p95 of [100, 200, ..., 2000] = element at index ceil(0.95 * 20) - 1 = 18 → 1900
      expect(stats[0].p95DurationMs).toBeGreaterThanOrEqual(1900);
      expect(stats[0].p95DurationMs).toBeLessThanOrEqual(2000);
    });

    it("should return one row per distinct toolName", () => {
      tokenStore.recordCall(projectId, "list", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 50 });
      tokenStore.recordCall(projectId, "context", { inputTokens: 100, outputTokens: 200, success: true, durationMs: 500 });
      tokenStore.recordCall(projectId, "next", { inputTokens: 50, outputTokens: 100, success: true, durationMs: 100 });

      const stats = tokenStore.getUsageStats(projectId);
      expect(stats).toHaveLength(3);
      const tools = stats.map((s) => s.toolName).sort();
      expect(tools).toEqual(["context", "list", "next"]);
    });

    it("should return lastUsedAt = most recent timestamp", () => {
      tokenStore.recordCall(projectId, "list", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 50 });

      const before = new Date().toISOString();
      tokenStore.recordCall(projectId, "list", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 50 });
      const after = new Date().toISOString();

      const stats = tokenStore.getUsageStats(projectId);
      expect(stats[0].lastUsedAt >= before).toBe(true);
      expect(stats[0].lastUsedAt <= after).toBe(true);
    });

    it("should filter by sinceDays when provided", () => {
      const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
      const recent = new Date().toISOString();

      // Manually insert OLD call
      sqliteStore.getDb().prepare(
        `INSERT INTO tool_token_usage (project_id, tool_name, input_tokens, output_tokens, called_at, success, duration_ms)
         VALUES (?, 'old_tool', 10, 20, ?, 1, 50)`,
      ).run(projectId, old);

      // Recent call via recordCall
      tokenStore.recordCall(projectId, "recent_tool", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 50 });
      void recent;

      const last30 = tokenStore.getUsageStats(projectId, 30);
      const tools30 = last30.map((s) => s.toolName);
      expect(tools30).toContain("recent_tool");
      expect(tools30).not.toContain("old_tool");

      const all = tokenStore.getUsageStats(projectId);
      const allTools = all.map((s) => s.toolName);
      expect(allTools).toContain("recent_tool");
      expect(allTools).toContain("old_tool");
    });

    it("should return empty array for project with no data (no crash)", () => {
      const stats = tokenStore.getUsageStats(projectId);
      expect(stats).toEqual([]);
    });

    it("should treat NULL success (legacy record() rows) as success=true", () => {
      // Legacy: record() inserts without success column
      tokenStore.record(projectId, "legacy_tool", 100, 200);
      tokenStore.recordCall(projectId, "new_tool", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 50 });

      const stats = tokenStore.getUsageStats(projectId);
      const legacyEntry = stats.find((s) => s.toolName === "legacy_tool")!;
      expect(legacyEntry.callCount).toBe(1);
      expect(legacyEntry.successRate).toBe(1); // NULL = legacy success
    });
  });
});
