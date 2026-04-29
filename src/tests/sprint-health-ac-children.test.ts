/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { analyzeSprintHealth } from "../core/planner/sprint-health.js";
import type { GraphDocument } from "../core/graph/graph-types.js";
import { makeNode } from "./helpers/factories.js";

function buildDoc(nodes: ReturnType<typeof makeNode>[]): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "test", name: "Test", createdAt: "2026-04-28T00:00:00Z", updatedAt: "2026-04-28T00:00:00Z" },
    meta: { sourceFiles: [], lastImport: null },
    nodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
  };
}

describe("sprint-health — AC counted via child acceptance_criteria nodes (BUG-03)", () => {
  it("task with 3 AC child nodes is NOT counted in tasksWithoutAC", () => {
    const doc = buildDoc([
      makeNode({ id: "t1", type: "task", title: "Task A", sprint: "S1", status: "ready" }),
      makeNode({ id: "ac1", type: "acceptance_criteria", title: "AC1", parentId: "t1" }),
      makeNode({ id: "ac2", type: "acceptance_criteria", title: "AC2", parentId: "t1" }),
      makeNode({ id: "ac3", type: "acceptance_criteria", title: "AC3", parentId: "t1" }),
    ]);

    const report = analyzeSprintHealth(doc, "S1");
    expect(report.metrics.tasksWithoutAC).toBe(0);
  });

  it("task with neither inline AC nor AC children IS counted in tasksWithoutAC", () => {
    const doc = buildDoc([
      makeNode({ id: "t1", type: "task", title: "Task A", sprint: "S1" }),
    ]);

    const report = analyzeSprintHealth(doc, "S1");
    expect(report.metrics.tasksWithoutAC).toBe(1);
  });

  it("task with inline AC is still counted as having AC (backward compatibility)", () => {
    const doc = buildDoc([
      makeNode({
        id: "t1",
        type: "task",
        title: "Task A",
        sprint: "S1",
        acceptanceCriteria: ["GIVEN x WHEN y THEN z"],
      }),
    ]);

    const report = analyzeSprintHealth(doc, "S1");
    expect(report.metrics.tasksWithoutAC).toBe(0);
  });

  it("mixed sprint: 2 tasks with AC children + 1 without → tasksWithoutAC=1", () => {
    const doc = buildDoc([
      makeNode({ id: "t1", type: "task", title: "T1", sprint: "S1" }),
      makeNode({ id: "ac1", type: "acceptance_criteria", title: "AC", parentId: "t1" }),
      makeNode({ id: "t2", type: "task", title: "T2", sprint: "S1" }),
      makeNode({ id: "ac2", type: "acceptance_criteria", title: "AC", parentId: "t2" }),
      makeNode({ id: "t3", type: "task", title: "T3", sprint: "S1" }),
    ]);

    const report = analyzeSprintHealth(doc, "S1");
    expect(report.metrics.taskCount).toBe(3);
    expect(report.metrics.tasksWithoutAC).toBe(1);
  });

  it("AC child node belonging to a task in a DIFFERENT sprint is ignored", () => {
    const doc = buildDoc([
      makeNode({ id: "t1", type: "task", title: "Task in S1", sprint: "S1" }),
      // AC child belongs to a task in another sprint — should not flip t1
      makeNode({ id: "tx", type: "task", title: "Task in S2", sprint: "S2" }),
      makeNode({ id: "ac_x", type: "acceptance_criteria", title: "AC", parentId: "tx" }),
    ]);

    const report = analyzeSprintHealth(doc, "S1");
    expect(report.metrics.tasksWithoutAC).toBe(1);
  });
});
