/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-23.T02 — capacity-health tests.
 */

import { describe, it, expect } from "vitest";
import { computeCapacityHealth } from "../core/analyzer/capacity-health.js";
import type { GraphDocument, GraphNode } from "../core/graph/graph-types.js";

function makeDoc(nodes: GraphNode[]): GraphDocument {
  return {
    project: "test",
    version: "1.0",
    nodes,
    edges: [],
    indexes: { byId: new Map(), byType: new Map(), byStatus: new Map() },
    meta: { generatedAt: "2026-04-29T00:00:00Z" },
  } as unknown as GraphDocument;
}

function task(id: string, sprint: string, xp: "XS" | "S" | "M" | "L" | "XL", status: GraphNode["status"], completedAt?: string): GraphNode {
  return {
    id,
    type: "task",
    title: id,
    status,
    priority: 3,
    blocked: false,
    createdAt: "2026-04-29T00:00:00Z",
    updatedAt: completedAt ?? "2026-04-29T00:00:00Z",
    xpSize: xp,
    sprint,
  };
}

describe("capacity-health (E23.T02)", () => {
  it("returns trivially ok when no sprint can be inferred", () => {
    const r = computeCapacityHealth(makeDoc([]));
    expect(r.sprintLabel).toBeNull();
    expect(r.withinTolerance).toBe(true);
  });

  it("flags within tolerance when current sprint matches prior velocity ±10%", () => {
    const nodes = [
      task("done-1", "s1", "M", "done"),
      task("done-2", "s1", "M", "done"),
      task("ip-1", "s2", "M", "in_progress"),
      task("ip-2", "s2", "M", "in_progress"),
    ];
    const r = computeCapacityHealth(makeDoc(nodes), "s2");
    expect(r.sprintLabel).toBe("s2");
    expect(r.sprintXpSizeSum).toBe(6);
    expect(r.velocityAvg).toBe(6);
    expect(r.deltaPct).toBe(0);
    expect(r.withinTolerance).toBe(true);
  });

  it("flags out of tolerance when sprint over-commits >10%", () => {
    const nodes = [
      task("done-1", "s1", "S", "done"), // 1pt
      task("done-2", "s1", "S", "done"), // 1pt → velocity avg 2
      task("ip-1", "s2", "L", "in_progress"), // 8pts → delta = (8-2)/2 = 3.0
    ];
    const r = computeCapacityHealth(makeDoc(nodes), "s2");
    expect(r.withinTolerance).toBe(false);
    expect(r.deltaPct).toBeGreaterThan(0.1);
  });

  it("flags as out when there is no prior history but sprint is committed", () => {
    const nodes = [task("ip-1", "s2", "M", "in_progress")];
    const r = computeCapacityHealth(makeDoc(nodes), "s2");
    expect(r.withinTolerance).toBe(false);
    expect(r.deltaPct).toBe(1);
  });
});
