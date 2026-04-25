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
import { buildToolUsageResponse } from "../mcp/tools/metrics.js";

describe("metrics({mode: tool_usage}) — V11 Maestro Phase 1", () => {
  let store: SqliteStore;
  let tokenStore: ToolTokenStore;
  let projectId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    const project = store.initProject("Test Project");
    projectId = project.id;
    tokenStore = new ToolTokenStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should return ok=false when no project initialized", () => {
    const noProjectStore = SqliteStore.open(":memory:");
    try {
      const res = buildToolUsageResponse(noProjectStore);
      expect(res.ok).toBe(false);
    } finally {
      noProjectStore.close();
    }
  });

  it("should return empty toolUsage list when no calls recorded", () => {
    const res = buildToolUsageResponse(store);
    expect(res.ok).toBe(true);
    expect(res.mode).toBe("tool_usage");
    expect(res.toolUsage).toEqual([]);
    expect(res.totalDistinctTools).toBe(0);
  });

  it("should aggregate per-tool stats when calls exist", () => {
    tokenStore.recordCall(projectId, "list", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 50 });
    tokenStore.recordCall(projectId, "list", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 60 });
    tokenStore.recordCall(projectId, "context", { inputTokens: 100, outputTokens: 200, success: false, durationMs: 500, errorKind: "timeout" });

    const res = buildToolUsageResponse(store);
    expect(res.ok).toBe(true);
    expect(res.totalDistinctTools).toBe(2);
    const list = res.toolUsage.find((s) => s.toolName === "list")!;
    expect(list.callCount).toBe(2);
    expect(list.successRate).toBe(1);
    const ctx = res.toolUsage.find((s) => s.toolName === "context")!;
    expect(ctx.callCount).toBe(1);
    expect(ctx.successRate).toBe(0);
  });

  it("should pass sinceDays through to getUsageStats", () => {
    // Old call (60 days ago)
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    store.getDb().prepare(
      `INSERT INTO tool_token_usage (project_id, tool_name, input_tokens, output_tokens, called_at, success, duration_ms)
       VALUES (?, 'old_tool', 10, 20, ?, 1, 50)`,
    ).run(projectId, old);

    // Recent call
    tokenStore.recordCall(projectId, "recent_tool", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 50 });

    const res30 = buildToolUsageResponse(store, 30);
    const tools30 = res30.toolUsage.map((s) => s.toolName);
    expect(tools30).toContain("recent_tool");
    expect(tools30).not.toContain("old_tool");
    expect(res30.sinceDays).toBe(30);

    const resAll = buildToolUsageResponse(store);
    const allTools = resAll.toolUsage.map((s) => s.toolName);
    expect(allTools).toContain("recent_tool");
    expect(allTools).toContain("old_tool");
    expect(resAll.sinceDays).toBeNull();
  });

  it("should expose deprecation-gate evidence (callCount=0 candidates)", () => {
    // davinci was never called → does not appear in stats
    tokenStore.recordCall(projectId, "list", { inputTokens: 10, outputTokens: 20, success: true, durationMs: 50 });

    const res = buildToolUsageResponse(store, 30);
    const tools = res.toolUsage.map((s) => s.toolName);
    expect(tools).not.toContain("davinci");
    expect(tools).not.toContain("siebel");
    expect(tools).not.toContain("translate");
    expect(tools).not.toContain("forecast");
    // → caller can compare registered tools vs stats to find callCount=0 candidates
  });
});
