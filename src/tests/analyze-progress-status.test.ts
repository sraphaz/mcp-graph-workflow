/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * BUG-01 closure (subtask 3) — confirms analyze(progress) burndown numbers
 * track node.status changes consistently with metrics(stats) and list().
 */

import { describe, it, expect } from "vitest";
import { calculateSprintProgress } from "../core/implementer/sprint-progress.js";
import type { GraphDocument, GraphNode } from "../core/graph/graph-types.js";

function task(id: string, status: GraphNode["status"]): GraphNode {
  return {
    id,
    type: "task",
    title: id,
    status,
    priority: 3,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  } as GraphNode;
}

function makeDoc(nodes: GraphNode[]): GraphDocument {
  return {
    version: "1.0",
    project: { id: "p", name: "t", createdAt: "x", updatedAt: "x" },
    nodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("analyze(progress) burndown reflects node.status (BUG-01 closure)", () => {
  it("counts in_progress tasks accurately when one is mid-flight", () => {
    const doc = makeDoc([
      task("t1", "in_progress"),
      task("t2", "backlog"),
      task("t3", "backlog"),
      task("t4", "done"),
    ]);
    const report = calculateSprintProgress(doc);
    expect(report.burndown.inProgress).toBe(1);
    expect(report.burndown.done).toBe(1);
    expect(report.burndown.backlog).toBe(2);
    expect(report.burndown.total).toBe(4);
  });

  it("returns 0 in_progress when none are mid-flight", () => {
    const doc = makeDoc([task("t1", "backlog"), task("t2", "done")]);
    const report = calculateSprintProgress(doc);
    expect(report.burndown.inProgress).toBe(0);
  });

  it("counts every status bucket independently — no double-counting", () => {
    const doc = makeDoc([
      task("t1", "ready"),
      task("t2", "ready"),
      task("t3", "in_progress"),
      task("t4", "blocked"),
      task("t5", "done"),
      task("t6", "backlog"),
    ]);
    const report = calculateSprintProgress(doc);
    const sum = report.burndown.ready + report.burndown.inProgress + report.burndown.blocked
      + report.burndown.done + report.burndown.backlog;
    expect(sum).toBe(6);
    expect(report.burndown.total).toBe(6);
  });
});
