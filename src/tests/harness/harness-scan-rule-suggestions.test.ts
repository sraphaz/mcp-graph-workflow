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

/**
 * TDD: Task 1.2 — ruleSuggestions exposed in harness_scan response
 *
 * Tests confirm that analyze(mode: "harness_scan") returns a `ruleSuggestions`
 * field populated from IssuePatternTracker.getSuggestedRules().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { registerAnalyze } from "../../mcp/tools/analyze.js";
import { IssuePatternTracker } from "../../core/harness/issue-pattern-tracker.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTools = any;

function createServer(): McpServer {
  return new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
}

function tools(server: McpServer): AnyTools {
  return (server as AnyTools)._registeredTools;
}

function parseResult(result: { content: { type: string; text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

describe("analyze(mode: 'harness_scan') — ruleSuggestions", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerAnalyze(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("should return ruleSuggestions as empty array when no patterns exist", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_scan" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.ruleSuggestions)).toBe(true);
    expect((parsed.ruleSuggestions as unknown[]).length).toBe(0);
  });

  it("should return ruleSuggestions with entries when patterns exceed threshold", async () => {
    // Seed 3 occurrences of missing_ac to cross default threshold
    const tracker = new IssuePatternTracker(store.getDb(), 3);
    tracker.recordIssue("missing_ac", "node_a");
    tracker.recordIssue("missing_ac", "node_b");
    tracker.recordIssue("missing_ac", "node_c");

    const result = await tools(server)["analyze"].handler({ mode: "harness_scan" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    const suggestions = parsed.ruleSuggestions as Array<{ patternType: string; count: number }>;
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions[0].patternType).toBe("missing_ac");
    expect(suggestions[0].count).toBe(3);
  });

  it("should cap ruleSuggestions at 5 entries even if 10 patterns exist", async () => {
    const tracker = new IssuePatternTracker(store.getDb(), 3);
    const patternTypes = [
      "missing_ac", "status_skip", "missing_description",
      "oversized_task", "missing_estimate", "pattern_6",
      "pattern_7", "pattern_8", "pattern_9", "pattern_10",
    ];
    // Drive each pattern over threshold
    for (const pt of patternTypes) {
      tracker.recordIssue(pt, "n1");
      tracker.recordIssue(pt, "n2");
      tracker.recordIssue(pt, "n3");
    }

    const result = await tools(server)["analyze"].handler({ mode: "harness_scan" });
    const parsed = parseResult(result);
    const suggestions = parsed.ruleSuggestions as unknown[];
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it("should not break existing harness_scan fields (regression guard)", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_scan" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(typeof parsed.score).toBe("number");
    expect(["A", "B", "C", "D"]).toContain(parsed.grade);
    expect(parsed.breakdown).toBeDefined();
    expect(typeof parsed.timestamp).toBe("string");
  });
});
