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
import { calculateVelocity } from "../core/planner/velocity.js";
import type { GraphDocument, GraphNode } from "../core/graph/graph-types.js";

function makeDoc(nodes: Partial<GraphNode>[]): GraphDocument {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node_${i}`,
    type: n.type ?? "task",
    title: n.title ?? `Task ${i}`,
    status: n.status ?? "done",
    priority: n.priority ?? 3,
    xpSize: n.xpSize ?? "S",
    sprint: n.sprint ?? "sprint-1",
    tags: n.tags,
    createdAt: n.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: n.updatedAt ?? "2026-01-01T02:00:00Z",
  })) as GraphNode[];

  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    nodes: fullNodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("calculateVelocity — byCategory", () => {
  it("should group done tasks by first tag as category", () => {
    const doc = makeDoc([
      { tags: ["code"], title: "Code task 1" },
      { tags: ["code", "backend"], title: "Code task 2" },
      { tags: ["ui"], title: "UI task" },
    ]);

    const result = calculateVelocity(doc);

    expect(result.byCategory).toBeDefined();
    expect(result.byCategory.length).toBe(2);

    const codeCategory = result.byCategory.find((c) => c.category === "code");
    const uiCategory = result.byCategory.find((c) => c.category === "ui");

    expect(codeCategory).toBeDefined();
    expect(codeCategory!.tasksCompleted).toBe(2);

    expect(uiCategory).toBeDefined();
    expect(uiCategory!.tasksCompleted).toBe(1);
  });

  it("should use (untagged) for tasks without tags", () => {
    const doc = makeDoc([
      { title: "No tags task" },
      { tags: ["code"], title: "Tagged task" },
    ]);

    const result = calculateVelocity(doc);

    const untagged = result.byCategory.find((c) => c.category === "(untagged)");
    expect(untagged).toBeDefined();
    expect(untagged!.tasksCompleted).toBe(1);
  });

  it("should include totalPoints and avgCompletionHours per category", () => {
    const doc = makeDoc([
      { tags: ["code"], xpSize: "M" as const, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T03:00:00Z" },
      { tags: ["code"], xpSize: "S" as const, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T01:00:00Z" },
    ]);

    const result = calculateVelocity(doc);

    const codeCategory = result.byCategory.find((c) => c.category === "code");
    expect(codeCategory).toBeDefined();
    expect(codeCategory!.totalPoints).toBeGreaterThan(0);
    expect(codeCategory!.avgCompletionHours).toBeGreaterThan(0);
  });
});

describe("calculateVelocity — null/undefined timestamps", () => {
  it("should handle nodes with null createdAt gracefully", () => {
    const doc = makeDoc([
      { createdAt: undefined as unknown as string, updatedAt: "2026-01-01T02:00:00Z" },
      { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T02:00:00Z" },
    ]);

    const result = calculateVelocity(doc);
    expect(result).toBeDefined();
    expect(result.overall).toBeDefined();
    if (result.overall.avgCompletionHours !== null) {
      expect(Number.isFinite(result.overall.avgCompletionHours)).toBe(true);
    }
  });

  it("should handle nodes with null updatedAt gracefully", () => {
    const doc = makeDoc([
      { createdAt: "2026-01-01T00:00:00Z", updatedAt: undefined as unknown as string },
    ]);

    const result = calculateVelocity(doc);
    expect(result).toBeDefined();
    expect(result.overall).toBeDefined();
  });

  it("should produce no NaN values in overall", () => {
    const doc = makeDoc([
      { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T04:00:00Z" },
      { createdAt: undefined as unknown as string, updatedAt: undefined as unknown as string },
    ]);

    const result = calculateVelocity(doc);
    expect(result.overall.avgCompletionHours === null || Number.isFinite(result.overall.avgCompletionHours)).toBe(true);
    expect(Number.isFinite(result.overall.totalTasksCompleted)).toBe(true);
    expect(Number.isFinite(result.overall.totalPoints)).toBe(true);
  });

  it("should include unassigned sprint bucket in avgPointsPerSprint denominator", () => {
    const doc = makeDoc([
      { sprint: "sprint-1", xpSize: "M" as const }, // 3 points
      { sprint: "(no sprint)", xpSize: "M" as const }, // 3 points
    ]);

    const result = calculateVelocity(doc);
    // 6 total points across 2 sprint buckets ("sprint-1" + "(no sprint)") = 3.0
    expect(result.overall.avgPointsPerSprint).toBe(3);
  });
});
