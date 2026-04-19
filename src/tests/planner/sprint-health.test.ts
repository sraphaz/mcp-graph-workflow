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
import { analyzeSprintHealth } from "../../core/planner/sprint-health.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";

function makeNode(overrides?: Partial<GraphNode>): GraphNode {
  const ts = now();
  return {
    id: generateId("node"),
    type: "task",
    title: "Default task",
    status: "backlog",
    priority: 3,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeEdge(from: string, to: string, relationType: string): GraphEdge {
  return {
    id: generateId("edge"),
    from,
    to,
    relationType: relationType as GraphEdge["relationType"],
    createdAt: now(),
  };
}

function makeDoc(nodes: GraphNode[], edges: GraphEdge[] = []): GraphDocument {
  return {
    version: "1.0",
    project: { id: "test", name: "Test", createdAt: now(), updatedAt: now() },
    nodes,
    edges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("analyzeSprintHealth", () => {
  it("should return healthy when all tasks are done", () => {
    // Arrange
    const nodes = [
      makeNode({ status: "done", sprint: "sprint-1", acceptanceCriteria: ["AC1"] }),
      makeNode({ status: "done", sprint: "sprint-1", acceptanceCriteria: ["AC1"] }),
      makeNode({ status: "done", sprint: "sprint-1", acceptanceCriteria: ["AC1"] }),
    ];
    const doc = makeDoc(nodes);

    // Act
    const report = analyzeSprintHealth(doc, "sprint-1");

    // Assert
    expect(report.health).toBe("healthy");
    expect(report.metrics.doneCount).toBe(3);
    expect(report.metrics.taskCount).toBe(3);
    expect(report.metrics.burndownRatio).toBe(1);
    expect(report.warnings).toHaveLength(0);
  });

  it("should return critical when >30% tasks are blocked", () => {
    // Arrange
    const nodes = [
      makeNode({ status: "blocked", blocked: true, sprint: "sprint-2" }),
      makeNode({ status: "blocked", blocked: true, sprint: "sprint-2" }),
      makeNode({ status: "ready", sprint: "sprint-2" }),
    ];
    const doc = makeDoc(nodes);

    // Act
    const report = analyzeSprintHealth(doc, "sprint-2");

    // Assert
    expect(report.health).toBe("critical");
    expect(report.metrics.blockedCount).toBe(2);
    expect(report.metrics.blockedRatio).toBeCloseTo(2 / 3);
    expect(report.warnings.some((w) => w.includes("blocked"))).toBe(true);
  });

  it("should return at_risk when tasks lack acceptance criteria", () => {
    // Arrange — >30% without AC triggers at_risk
    const nodes = [
      makeNode({ status: "ready", sprint: "sprint-3", acceptanceCriteria: [] }),
      makeNode({ status: "ready", sprint: "sprint-3" }), // undefined AC
      makeNode({ status: "done", sprint: "sprint-3", acceptanceCriteria: ["AC1"] }),
    ];
    const doc = makeDoc(nodes);

    // Act
    const report = analyzeSprintHealth(doc, "sprint-3");

    // Assert
    expect(report.health).toBe("at_risk");
    expect(report.metrics.tasksWithoutAC).toBe(2);
    expect(report.warnings.some((w) => w.includes("acceptance criteria"))).toBe(true);
  });

  it("should detect external dependencies and warn", () => {
    // Arrange
    const sprintTask = makeNode({ id: "task-in-sprint", sprint: "sprint-4", status: "ready" });
    const externalTask = makeNode({ id: "task-external", sprint: "sprint-5", status: "ready" });
    const edge = makeEdge("task-in-sprint", "task-external", "depends_on");
    const doc = makeDoc([sprintTask, externalTask], [edge]);

    // Act
    const report = analyzeSprintHealth(doc, "sprint-4");

    // Assert
    expect(report.metrics.externalDeps).toBe(1);
    expect(report.warnings.some((w) => w.includes("external dependencies"))).toBe(true);
  });

  it("should filter by sprint name", () => {
    // Arrange
    const s1Task = makeNode({ status: "done", sprint: "sprint-1", acceptanceCriteria: ["AC1"] });
    const s2Task = makeNode({ status: "blocked", blocked: true, sprint: "sprint-2" });
    const doc = makeDoc([s1Task, s2Task]);

    // Act
    const report1 = analyzeSprintHealth(doc, "sprint-1");
    const report2 = analyzeSprintHealth(doc, "sprint-2");

    // Assert
    expect(report1.metrics.taskCount).toBe(1);
    expect(report1.health).toBe("healthy");
    expect(report2.metrics.taskCount).toBe(1);
    expect(report2.health).toBe("critical");
  });

  it("should include all tasks when no sprint filter provided", () => {
    // Arrange
    const nodes = [
      makeNode({ status: "done", sprint: "sprint-1" }),
      makeNode({ status: "ready", sprint: "sprint-2" }),
      makeNode({ status: "ready" }), // no sprint
    ];
    const doc = makeDoc(nodes);

    // Act
    const report = analyzeSprintHealth(doc);

    // Assert
    expect(report.metrics.taskCount).toBe(3);
    expect(report.sprint).toBeNull();
  });

  it("should calculate total points correctly", () => {
    // Arrange
    const nodes = [
      makeNode({ status: "ready", sprint: "s1", xpSize: "S" }),  // 2
      makeNode({ status: "ready", sprint: "s1", xpSize: "L" }),  // 5
      makeNode({ status: "ready", sprint: "s1", xpSize: "XL" }), // 8
    ];
    const doc = makeDoc(nodes);

    // Act
    const report = analyzeSprintHealth(doc, "s1");

    // Assert
    expect(report.metrics.totalPoints).toBe(15); // 2 + 5 + 8
  });
});
