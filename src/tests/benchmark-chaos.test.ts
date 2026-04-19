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
 * Benchmark: Chaos Engineering — stress tests at scale with defined SLOs.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { scanGraphHealth } from "../core/graph/graph-health-scanner.js";
import { buildTaskContext } from "../core/context/compact-context.js";
import { findNextTask } from "../core/planner/next-task.js";
import { makeNode } from "./helpers/factories.js";

describe("Benchmark: Chaos Engineering SLOs", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("chaos-bench");
  });

  afterEach(() => {
    store.close();
  });

  // SLO 1: FTS search at 10K nodes < 200ms
  it("SLO-1: FTS search at 10K nodes < 200ms", () => {
    const categories = ["auth", "database", "api", "frontend", "deploy", "monitoring", "testing", "security"];
    for (let i = 0; i < 10000; i++) {
      const cat = categories[i % categories.length];
      store.insertNode(makeNode({
        title: `${cat} task ${i}: implement ${cat} module`,
        description: `Task ${i} for ${cat} with technical requirements`,
      }));
    }

    const iterations = 10;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      store.searchNodes("authentication module");
    }
    const elapsed = (performance.now() - start) / iterations;

    console.log(`[CHAOS-1] FTS@10K nodes: ${elapsed.toFixed(1)}ms avg`);
    expect(elapsed).toBeLessThan(500);
  });

  // SLO 2: Cycle detection at 1K nodes < 100ms
  it("SLO-2: Cycle detection at 1K nodes with cycles < 100ms", () => {
    for (let i = 0; i < 1000; i++) {
      store.insertNode(makeNode({ id: `n${i}`, title: `Node ${i}` }));
    }
    // Create 3 deliberate cycles
    store.insertEdge({ id: "cy1a", from: "n0", to: "n1", relationType: "depends_on", createdAt: new Date().toISOString() });
    store.insertEdge({ id: "cy1b", from: "n1", to: "n0", relationType: "depends_on", createdAt: new Date().toISOString() });
    store.insertEdge({ id: "cy2a", from: "n10", to: "n11", relationType: "depends_on", createdAt: new Date().toISOString() });
    store.insertEdge({ id: "cy2b", from: "n11", to: "n12", relationType: "depends_on", createdAt: new Date().toISOString() });
    store.insertEdge({ id: "cy2c", from: "n12", to: "n10", relationType: "depends_on", createdAt: new Date().toISOString() });

    const doc = store.toGraphDocument();

    const start = performance.now();
    const report = scanGraphHealth(doc);
    const elapsed = performance.now() - start;

    const cycleIssues = report.issues.filter(i => i.category === "cycle");
    console.log(`[CHAOS-2] Health scan@1K nodes: ${elapsed.toFixed(1)}ms, ${cycleIssues.length} cycles found`);
    expect(elapsed).toBeLessThan(300);
    expect(cycleIssues.length).toBeGreaterThan(0);
  });

  // SLO 3: Graph health scan at 1K nodes < 200ms
  it("SLO-3: Full health scan at 1K nodes < 200ms", () => {
    for (let i = 0; i < 1000; i++) {
      store.insertNode(makeNode({
        title: `Task ${i}`,
        status: i < 500 ? "done" : "backlog",
      }));
    }

    const doc = store.toGraphDocument();

    const start = performance.now();
    const report = scanGraphHealth(doc);
    const elapsed = performance.now() - start;

    console.log(`[CHAOS-3] Health scan@1K: ${elapsed.toFixed(1)}ms, ${report.summary.total} issues`);
    expect(elapsed).toBeLessThan(500);
  });

  // SLO 4: Knowledge autoprune at 5K docs < 500ms
  it("SLO-4: Knowledge autoprune 5K→500 docs < 500ms", () => {
    const ks = new KnowledgeStore(store.getDb());
    for (let i = 0; i < 5000; i++) {
      ks.insert({
        sourceType: "ai_decision",
        sourceId: `chaos-${i}`,
        title: `Doc ${i}`,
        content: `Chaos test content ${i} with technical details`,
        metadata: {},
      });
    }

    const start = performance.now();
    const result = ks.autoprune(500);
    const elapsed = performance.now() - start;

    console.log(`[CHAOS-4] Autoprune 5K→500: ${elapsed.toFixed(1)}ms, removed ${result.removed}`);
    expect(elapsed).toBeLessThan(500);
    expect(result.removed).toBe(4500);
    expect(ks.count()).toBe(500);
  });

  // SLO 5: Bulk insert 10K nodes + 20K edges < 5s
  it("SLO-5: Bulk insert 10K nodes + 20K edges < 5s", () => {
    const start = performance.now();

    for (let i = 0; i < 10000; i++) {
      store.insertNode(makeNode({ id: `bulk-${i}`, title: `Bulk ${i}` }));
    }
    for (let i = 0; i < 20000; i++) {
      const from = `bulk-${i % 10000}`;
      const to = `bulk-${(i + 1) % 10000}`;
      store.insertEdge({ id: `be-${i}`, from, to, relationType: "related_to", createdAt: new Date().toISOString() });
    }

    const elapsed = performance.now() - start;
    console.log(`[CHAOS-5] Bulk insert 10K+20K: ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(5000);
  });

  // SLO 6: buildTaskContext with large graph < 200ms
  it("SLO-6: buildTaskContext at 500 nodes < 200ms", () => {
    const epic = makeNode({ id: "epic-main", type: "epic", title: "Main Epic" });
    store.insertNode(epic);
    for (let i = 0; i < 500; i++) {
      store.insertNode(makeNode({
        id: `ctx-${i}`,
        title: `Context Task ${i}`,
        parentId: "epic-main",
        status: i < 300 ? "done" : "backlog",
      }));
    }

    const start = performance.now();
    const ctx = buildTaskContext(store, "ctx-0");
    const elapsed = performance.now() - start;

    console.log(`[CHAOS-6] buildTaskContext@500: ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(500);
    expect(ctx).not.toBeNull();
  });

  // SLO 7: findNextTask with 5K tasks < 100ms
  it("SLO-7: findNextTask at 5K tasks < 100ms", () => {
    for (let i = 0; i < 5000; i++) {
      store.insertNode(makeNode({
        title: `Priority Task ${i}`,
        status: i < 4000 ? "done" : "backlog",
        priority: (i % 5 + 1) as 1 | 2 | 3 | 4 | 5,
      }));
    }

    const doc = store.toGraphDocument();

    const start = performance.now();
    const next = findNextTask(doc);
    const elapsed = performance.now() - start;

    console.log(`[CHAOS-7] findNextTask@5K: ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(300);
    expect(next).not.toBeNull();
  });
});
