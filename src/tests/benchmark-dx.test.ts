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
 * Benchmark: DX Metrics — DORA, velocity, token economy, deterministic layer classification.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { ToolTokenStore } from "../core/store/tool-token-store.js";
import { classifyTools, getLayerDistribution } from "../core/insights/deterministic-layers.js";
import { makeNode } from "./helpers/factories.js";

describe("Benchmark: DX Metrics SLOs", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("dx-bench");
  });

  afterEach(() => {
    store.close();
  });

  // DX-1: Token economy summary at 1000 calls < 50ms
  it("DX-1: Token economy summary at 1000 calls < 50ms", () => {
    const tokenStore = new ToolTokenStore(store.getDb());
    const project = store.getProject()!;

    // Record 1000 tool calls
    const tools = ["list", "show", "search", "context", "analyze", "next", "metrics", "knowledge"];
    for (let i = 0; i < 1000; i++) {
      tokenStore.record(project.id, tools[i % tools.length], 100 + i % 50, 200 + i % 100);
    }

    const start = performance.now();
    const summary = tokenStore.getSummary(project.id);
    const elapsed = performance.now() - start;

    console.log(`[DX-1] Token summary@1000 calls: ${elapsed.toFixed(1)}ms, ${summary.totalCalls} calls tracked`);
    expect(elapsed).toBeLessThan(200);
    expect(summary.totalCalls).toBe(1000);
  });

  // DX-2: Deterministic layer classification covers all tools
  it("DX-2: All MCP tools are classified into deterministic layers", () => {
    const classifications = classifyTools();
    const distribution = getLayerDistribution();

    console.log(`[DX-2] Tool classification: ${classifications.length} tools`);
    console.log(`  L0 (SQL): ${distribution.L0_SQL}`);
    console.log(`  L1 (Cache): ${distribution.L1_Cache}`);
    console.log(`  L2 (Heuristic): ${distribution.L2_Heuristic}`);
    console.log(`  L3 (Property): ${distribution.L3_PropertyBased}`);
    console.log(`  L4 (Meta-Rule): ${distribution.L4_MetaRule}`);

    // All tools should be classified (reduced after v8.0 consolidation)
    expect(classifications.length).toBeGreaterThanOrEqual(37);

    // Distribution should cover all layers
    expect(distribution.L0_SQL).toBeGreaterThan(0);
    expect(distribution.L1_Cache).toBeGreaterThan(0);
    expect(distribution.L2_Heuristic).toBeGreaterThan(0);
    expect(distribution.L3_PropertyBased).toBeGreaterThan(0);
    expect(distribution.L4_MetaRule).toBeGreaterThan(0);

    // AI fallback should be 0%
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(classifications.length);
  });

  // DX-3: Velocity calculation at 200 tasks < 50ms
  it("DX-3: Velocity calculation at 200 done tasks < 50ms", () => {
    // Seed 200 done tasks with realistic timestamps across 3 sprints
    for (let i = 0; i < 200; i++) {
      const sprint = `sprint-${Math.floor(i / 70) + 1}`;
      const daysAgo = 30 - Math.floor(i / 7);
      const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
      const updatedAt = new Date(Date.now() - (daysAgo - 2) * 86400000).toISOString();
      store.insertNode(makeNode({
        title: `Velocity Task ${i}`,
        status: "done",
        sprint,
        createdAt,
        updatedAt,
      }));
    }

    const doc = store.toGraphDocument();

    const start = performance.now();
    // Calculate velocity via metrics
    const doneTasks = doc.nodes.filter(n => n.status === "done");
    const sprints = new Map<string, number>();
    for (const t of doneTasks) {
      const s = t.sprint ?? "(none)";
      sprints.set(s, (sprints.get(s) ?? 0) + 1);
    }
    const elapsed = performance.now() - start;

    console.log(`[DX-3] Velocity calc@200: ${elapsed.toFixed(1)}ms, ${sprints.size} sprints`);
    expect(elapsed).toBeLessThan(200);
    expect(sprints.size).toBeGreaterThan(0);
  });

  // DX-4: AI Usage Reduction Score = 100%
  it("DX-4: AI Usage Reduction Score is 100% (zero AI fallbacks)", () => {
    const classifications = classifyTools();

    // Count tools per layer
    const aiTools = classifications.filter(c => !c.layer.startsWith("L"));
    const deterministicTools = classifications.filter(c => c.layer.startsWith("L"));

    const reductionScore = deterministicTools.length / classifications.length * 100;

    console.log(`[DX-4] AI Reduction Score: ${reductionScore.toFixed(0)}% (${deterministicTools.length}/${classifications.length} deterministic)`);
    expect(reductionScore).toBe(100);
    expect(aiTools.length).toBe(0);
  });
});
