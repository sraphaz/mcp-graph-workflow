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
import { checkListeningReadiness } from "../core/listener/feedback-readiness.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";

function makeNode(overrides: Partial<GraphNode> & { id: string; title: string }): GraphNode {
  return {
    type: "task",
    status: "done",
    priority: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDoc(nodes: GraphNode[], edges: GraphEdge[] = []): GraphDocument {
  return {
    version: "1.0",
    project: { id: "test", name: "test", createdAt: "", updatedAt: "" },
    nodes,
    edges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("BUG-27: feedback-readiness blocked task detection", () => {
  it("should NOT treat unresolved depends_on as blocked — only status=blocked counts (Bug #012)", () => {
    const nodes = [
      makeNode({ id: "t1", title: "Task 1", status: "ready" }),
      makeNode({ id: "t2", title: "Blocker", status: "in_progress" }),
    ];
    const edges: GraphEdge[] = [{
      id: "e1",
      from: "t1",
      to: "t2",
      relationType: "depends_on",
      createdAt: new Date().toISOString(),
    }];
    const report = checkListeningReadiness(makeDoc(nodes, edges));
    const blockedCheck = report.checks.find((c) => c.name === "no_blocked");
    // Unresolved deps should NOT count as "blocked" — only status=blocked should
    expect(blockedCheck?.passed).toBe(true);
  });

  it("should detect tasks with status=blocked as blocked", () => {
    const nodes = [
      makeNode({ id: "t1", title: "Task 1", status: "blocked" }),
      makeNode({ id: "t2", title: "Task 2", status: "done" }),
    ];
    const report = checkListeningReadiness(makeDoc(nodes));
    const blockedCheck = report.checks.find((c) => c.name === "no_blocked");
    expect(blockedCheck?.passed).toBe(false);
  });

  it("should pass when there are no blocked tasks", () => {
    const nodes = [
      makeNode({ id: "t1", title: "Task 1", status: "done" }),
    ];
    const report = checkListeningReadiness(makeDoc(nodes));
    const blockedCheck = report.checks.find((c) => c.name === "no_blocked");
    expect(blockedCheck?.passed).toBe(true);
  });
});
