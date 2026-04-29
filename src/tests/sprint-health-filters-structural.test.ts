/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { analyzeSprintHealth } from "../core/planner/sprint-health.js";
import type { GraphDocument, GraphEdge, GraphNode } from "../core/graph/graph-types.js";

function makeDoc(nodes: GraphNode[], edges: GraphEdge[] = []): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "test", name: "Test", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    meta: { sourceFiles: [], lastImport: null },
    nodes,
    edges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
  };
}

function task(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    type: "task",
    title: id,
    status: "backlog",
    priority: 3,
    blocked: false,
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
    acceptanceCriteria: ["AC1"],
    ...overrides,
  };
}

describe("sprint-health: structural filter", () => {
  it("excludes nodes with metadata.implementable=false from taskCount", () => {
    const doc = makeDoc([
      task("real-1"),
      task("real-2", { status: "done" }),
      task("structural-1", { metadata: { implementable: false } }),
      task("structural-2", { metadata: { implementable: false } }),
    ]);
    const report = analyzeSprintHealth(doc);
    expect(report.metrics.taskCount).toBe(2);
    expect(report.metrics.doneCount).toBe(1);
    expect(report.metrics.burndownRatio).toBe(0.5);
    expect(report.metrics.structuralCount).toBe(2);
  });

  it("treats nodes without metadata.implementable as implementable (default)", () => {
    const doc = makeDoc([task("a"), task("b", { metadata: { origin: "imported" } })]);
    const report = analyzeSprintHealth(doc);
    expect(report.metrics.taskCount).toBe(2);
    expect(report.metrics.structuralCount).toBe(0);
  });

  it("structural nodes do not count toward tasksWithoutAC warning", () => {
    const doc = makeDoc([
      task("real", { acceptanceCriteria: ["AC"] }),
      task("structural", {
        metadata: { implementable: false },
        acceptanceCriteria: undefined,
      }),
    ]);
    const report = analyzeSprintHealth(doc);
    expect(report.metrics.tasksWithoutAC).toBe(0);
  });
});
