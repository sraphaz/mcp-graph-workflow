/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { analyzeAutoReady } from "../core/planner/auto-ready.js";
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
    sprint: "S1",
    acceptanceCriteria: ["AC"],
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("auto-ready: skip structural nodes", () => {
  it("does not promote nodes with metadata.implementable=false", () => {
    const doc = makeDoc([
      task("real"),
      task("structural", { metadata: { implementable: false } }),
    ]);
    const report = analyzeAutoReady(doc);
    expect(report.totalCandidates).toBe(1);
    expect(report.candidates[0].nodeId).toBe("real");
  });
});
