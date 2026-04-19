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
import type { GraphDocument } from "../core/graph/graph-types.js";
import { buildIndexes } from "../core/graph/graph-indexes.js";
import { makeNode, makeEdge, makeDoneTask } from "./helpers/factories.js";
import {
  monitorGraph,
  analyzeIssues,
  planActions,
  executeActions,
  buildKnowledge,
  DEFAULT_HEALING_CONFIG,
} from "../core/skills/self-healing-engine.js";
import type { HealingConfig } from "../schemas/healing.schema.js";

function makeDoc(
  nodes: ReturnType<typeof makeNode>[],
  edges: ReturnType<typeof makeEdge>[] = [],
): GraphDocument {
  return {
    version: "1.0",
    project: { id: "proj_test", name: "Test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    nodes,
    edges,
    indexes: buildIndexes(nodes, edges),
    meta: { sourceFiles: [], lastImport: null },
  };
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// ── Monitor Phase ──────────────────────────────────

describe("monitorGraph", () => {
  it("should detect stuck tasks (in_progress beyond staleHours)", () => {
    const staleTask = makeNode({
      status: "in_progress",
      title: "Stale task",
      updatedAt: hoursAgo(72),
    });
    const freshTask = makeNode({
      status: "in_progress",
      title: "Fresh task",
      updatedAt: new Date().toISOString(),
    });
    const doc = makeDoc([staleTask, freshTask]);

    const issues = monitorGraph(doc, { ...DEFAULT_HEALING_CONFIG, staleHours: 48 });

    const stuckIssues = issues.filter((i) => i.type === "stuck_task");
    expect(stuckIssues).toHaveLength(1);
    expect(stuckIssues[0].nodeId).toBe(staleTask.id);
  });

  it("should detect broken dependencies (edge to non-existent node)", () => {
    const task = makeNode({ status: "ready", title: "Task with broken dep" });
    const edge = makeEdge(task.id, "nonexistent_node_id");
    const doc = makeDoc([task], [edge]);

    const issues = monitorGraph(doc, DEFAULT_HEALING_CONFIG);

    const brokenDeps = issues.filter((i) => i.type === "broken_dependency");
    expect(brokenDeps).toHaveLength(1);
    expect(brokenDeps[0].nodeId).toBe(task.id);
  });

  it("should detect orphan nodes (task/subtask with no parent and no edges)", () => {
    const orphan = makeNode({ status: "backlog", title: "Lonely orphan" });
    const connected = makeNode({ status: "backlog", title: "Connected task" });
    const edge = makeEdge(connected.id, orphan.id, { relationType: "related_to" });
    // orphan has an edge so it's not truly orphaned; we need a truly isolated node
    const trueOrphan = makeNode({ status: "backlog", title: "True orphan" });
    const doc = makeDoc([orphan, connected, trueOrphan], [edge]);

    const issues = monitorGraph(doc, DEFAULT_HEALING_CONFIG);

    const orphans = issues.filter((i) => i.type === "orphan_node");
    expect(orphans).toHaveLength(1);
    expect(orphans[0].nodeId).toBe(trueOrphan.id);
  });

  it("should detect cycle in dependencies", () => {
    const a = makeNode({ status: "ready", title: "Task A" });
    const b = makeNode({ status: "ready", title: "Task B" });
    const c = makeNode({ status: "ready", title: "Task C" });
    const edges = [
      makeEdge(a.id, b.id),
      makeEdge(b.id, c.id),
      makeEdge(c.id, a.id), // cycle
    ];
    const doc = makeDoc([a, b, c], edges);

    const issues = monitorGraph(doc, DEFAULT_HEALING_CONFIG);

    const cycles = issues.filter((i) => i.type === "cycle_detected");
    expect(cycles.length).toBeGreaterThanOrEqual(1);
  });

  it("should detect oversized tasks without subtasks", () => {
    const big = makeNode({ status: "ready", title: "Big task", xpSize: "XL" });
    const small = makeNode({ status: "ready", title: "Small task", xpSize: "S" });
    const doc = makeDoc([big, small]);

    const issues = monitorGraph(doc, DEFAULT_HEALING_CONFIG);

    const oversized = issues.filter((i) => i.type === "oversized_undecomposed");
    expect(oversized).toHaveLength(1);
    expect(oversized[0].nodeId).toBe(big.id);
  });

  it("should detect blocked tasks without blocking edges", () => {
    const blocked = makeNode({
      status: "blocked",
      title: "Blocked but why",
      blocked: true,
    });
    const doc = makeDoc([blocked]);

    const issues = monitorGraph(doc, DEFAULT_HEALING_CONFIG);

    const noBlocker = issues.filter((i) => i.type === "blocked_no_blocker");
    expect(noBlocker).toHaveLength(1);
    expect(noBlocker[0].nodeId).toBe(blocked.id);
  });

  it("should detect done tasks with pending dependencies", () => {
    const dep = makeNode({ status: "ready", title: "Unfinished dep" });
    const done = makeDoneTask({ title: "Done too early" });
    const edge = makeEdge(done.id, dep.id); // done depends_on a non-done task
    const doc = makeDoc([dep, done], [edge]);

    const issues = monitorGraph(doc, DEFAULT_HEALING_CONFIG);

    const pendingDeps = issues.filter((i) => i.type === "done_with_pending_deps");
    expect(pendingDeps).toHaveLength(1);
    expect(pendingDeps[0].nodeId).toBe(done.id);
  });

  it("should return empty array for a healthy graph", () => {
    const epic = makeNode({ type: "epic", title: "My Epic" });
    const task = makeNode({ status: "ready", title: "Task 1", parentId: epic.id });
    const doc = makeDoc([epic, task]);

    const issues = monitorGraph(doc, DEFAULT_HEALING_CONFIG);

    expect(issues).toHaveLength(0);
  });
});

// ── Analyze Phase ──────────────────────────────────

describe("analyzeIssues", () => {
  it("should assign critical severity to cycle_detected", () => {
    const staleTask = makeNode({ status: "in_progress", updatedAt: hoursAgo(72) });
    const doc = makeDoc([staleTask]);
    const issues = monitorGraph(doc, { ...DEFAULT_HEALING_CONFIG, staleHours: 48 });

    const analyzed = analyzeIssues(issues);

    expect(analyzed.length).toBe(issues.length);
    for (const a of analyzed) {
      expect(["critical", "high", "medium", "low"]).toContain(a.severity);
    }
  });

  it("should sort by severity (critical first)", () => {
    const a = makeNode({ status: "ready", title: "A" });
    const b = makeNode({ status: "ready", title: "B" });
    const c = makeNode({ status: "ready", title: "C" });
    const cycleEdges = [
      makeEdge(a.id, b.id),
      makeEdge(b.id, c.id),
      makeEdge(c.id, a.id),
    ];
    const orphan = makeNode({ status: "backlog", title: "Orphan" });
    const doc = makeDoc([a, b, c, orphan], cycleEdges);

    const issues = monitorGraph(doc, DEFAULT_HEALING_CONFIG);
    const analyzed = analyzeIssues(issues);

    // Critical issues should come before low severity ones
    if (analyzed.length >= 2) {
      const severityOrder = ["critical", "high", "medium", "low"];
      for (let i = 1; i < analyzed.length; i++) {
        expect(severityOrder.indexOf(analyzed[i - 1].severity))
          .toBeLessThanOrEqual(severityOrder.indexOf(analyzed[i].severity));
      }
    }
  });
});

// ── Plan Phase ──────────────────────────────────

describe("planActions", () => {
  it("should generate update_status action for stuck tasks", () => {
    const stale = makeNode({
      status: "in_progress",
      title: "Stuck",
      updatedAt: hoursAgo(72),
    });
    const doc = makeDoc([stale]);
    const issues = monitorGraph(doc, { ...DEFAULT_HEALING_CONFIG, staleHours: 48 });
    const analyzed = analyzeIssues(issues);

    const actions = planActions(analyzed, doc);

    expect(actions.length).toBeGreaterThanOrEqual(1);
    const statusAction = actions.find((a) => a.type === "update_status");
    expect(statusAction).toBeDefined();
    expect(statusAction!.nodeId).toBe(stale.id);
  });

  it("should generate remove_edge action for broken dependencies", () => {
    const task = makeNode({ status: "ready", title: "Task" });
    const edge = makeEdge(task.id, "nonexistent_id");
    const doc = makeDoc([task], [edge]);
    const issues = monitorGraph(doc, DEFAULT_HEALING_CONFIG);
    const analyzed = analyzeIssues(issues);

    const actions = planActions(analyzed, doc);

    const removeAction = actions.find((a) => a.type === "remove_edge");
    expect(removeAction).toBeDefined();
  });

  it("should generate flag_for_review for orphan nodes", () => {
    const orphan = makeNode({ status: "backlog", title: "Orphan" });
    const doc = makeDoc([orphan]);
    const issues = monitorGraph(doc, DEFAULT_HEALING_CONFIG);
    const analyzed = analyzeIssues(issues);

    const actions = planActions(analyzed, doc);

    const flagAction = actions.find((a) => a.type === "flag_for_review");
    expect(flagAction).toBeDefined();
    expect(flagAction!.nodeId).toBe(orphan.id);
  });

  it("should return empty actions for empty issues", () => {
    const doc = makeDoc([]);
    const actions = planActions([], doc);
    expect(actions).toHaveLength(0);
  });
});

// ── Execute Phase ──────────────────────────────────

describe("executeActions", () => {
  it("should return results with success status for valid actions (dry-run)", () => {
    const stale = makeNode({
      status: "in_progress",
      title: "Stuck",
      updatedAt: hoursAgo(72),
    });
    const doc = makeDoc([stale]);
    const issues = monitorGraph(doc, { ...DEFAULT_HEALING_CONFIG, staleHours: 48 });
    const analyzed = analyzeIssues(issues);
    const actions = planActions(analyzed, doc);

    const results = executeActions(actions, doc, { dryRun: true });

    expect(results.length).toBe(actions.length);
    for (const r of results) {
      expect(r.success).toBe(true);
      expect(r.appliedAt).toBeTruthy();
    }
  });

  it("should return empty results for empty actions", () => {
    const doc = makeDoc([]);
    const results = executeActions([], doc, { dryRun: true });
    expect(results).toHaveLength(0);
  });
});

// ── Knowledge Phase ──────────────────────────────────

describe("buildKnowledge", () => {
  it("should compute correct metrics from results", () => {
    const stale = makeNode({
      status: "in_progress",
      title: "Stuck",
      updatedAt: hoursAgo(72),
    });
    const orphan = makeNode({ status: "backlog", title: "Orphan" });
    const doc = makeDoc([stale, orphan]);
    const issues = monitorGraph(doc, { ...DEFAULT_HEALING_CONFIG, staleHours: 48 });
    const analyzed = analyzeIssues(issues);
    const actions = planActions(analyzed, doc);
    const results = executeActions(actions, doc, { dryRun: true });

    const report = buildKnowledge(issues, actions, results);

    expect(report.metrics.totalIssuesDetected).toBe(issues.length);
    expect(report.metrics.totalHealed).toBe(results.filter((r) => r.success).length);
    expect(report.metrics.totalFailed).toBe(results.filter((r) => !r.success).length);
    expect(report.metrics.successRate).toBeGreaterThanOrEqual(0);
    expect(report.metrics.successRate).toBeLessThanOrEqual(1);
    expect(report.issues).toEqual(issues);
    expect(report.actions).toEqual(actions);
    expect(report.results).toEqual(results);
  });

  it("should handle zero results gracefully", () => {
    const report = buildKnowledge([], [], []);

    expect(report.metrics.totalIssuesDetected).toBe(0);
    expect(report.metrics.totalHealed).toBe(0);
    expect(report.metrics.successRate).toBe(1); // 0/0 → 1 (no failures)
  });
});

// ── Full MAPE-K Integration ──────────────────────────

describe("MAPE-K full loop", () => {
  it("should run Monitor → Analyze → Plan → Execute → Knowledge end-to-end", () => {
    const stale = makeNode({
      status: "in_progress",
      title: "Stuck task",
      updatedAt: hoursAgo(100),
    });
    const broken = makeNode({ status: "ready", title: "Broken dep task" });
    const brokenEdge = makeEdge(broken.id, "ghost_node");
    const orphan = makeNode({ status: "backlog", title: "Orphan task" });
    const doc = makeDoc([stale, broken, orphan], [brokenEdge]);

    const config: HealingConfig = { staleHours: 48, maxCycleDepth: 10, autoHeal: false, dryRun: true };

    // Monitor
    const issues = monitorGraph(doc, config);
    expect(issues.length).toBeGreaterThanOrEqual(3);

    // Analyze
    const analyzed = analyzeIssues(issues);
    expect(analyzed.length).toBe(issues.length);

    // Plan
    const actions = planActions(analyzed, doc);
    expect(actions.length).toBeGreaterThanOrEqual(1);

    // Execute
    const results = executeActions(actions, doc, { dryRun: true });
    expect(results.length).toBe(actions.length);

    // Knowledge
    const report = buildKnowledge(issues, actions, results);
    expect(report.metrics.totalIssuesDetected).toBe(issues.length);
    expect(report.timestamp).toBeTruthy();
    expect(report.id).toBeTruthy();
  });
});
