/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * BUG-04 — import_prd sprint milestone auto-creation.
 *
 * AC1: GIVEN PRD with sprint: 'sprint-1' annotations WHEN import_prd finishes
 *      THEN milestone node 'sprint-1' exists with metadata.sprintLabel
 * AC2: GIVEN import run twice WHEN sprint nodes queried THEN no duplicates (idempotent)
 * AC3: GIVEN sprint milestone exists WHEN store.getAllNodes() filtered by type 'milestone'
 *      THEN sprintLabel metadata is present and count >= 1
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { ensureSprintMilestones } from "../mcp/tools/import-prd.js";
import type { GraphNode } from "../core/graph/graph-types.js";
import { generateId } from "../core/utils/id.js";

function makeTaskNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: generateId(),
    type: "task",
    title: "Test Task",
    status: "backlog",
    priority: 3,
    blocked: false,
    acceptanceCriteria: [],
    tags: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ensureSprintMilestones — sprint milestone auto-creation", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("test-sprint-milestones");
  });

  afterEach(() => {
    store.close();
  });

  it("AC1: creates a milestone node for a single sprint label", () => {
    const created = ensureSprintMilestones(store, ["sprint-1"]);

    expect(created).toBe(1);
    const milestones = store.getAllNodes().filter((n) => n.type === "milestone");
    expect(milestones).toHaveLength(1);
    expect(milestones[0].title).toBe("sprint-1");
    expect(milestones[0].metadata?.sprintLabel).toBe("sprint-1");
    expect(milestones[0].metadata?.autoCreated).toBe(true);
  });

  it("AC1: creates milestone nodes for multiple unique sprint labels", () => {
    const created = ensureSprintMilestones(store, ["sprint-1", "sprint-2", "sprint-3"]);

    expect(created).toBe(3);
    const milestones = store.getAllNodes().filter((n) => n.type === "milestone");
    const labels = milestones.map((m) => m.metadata?.sprintLabel).sort();
    expect(labels).toEqual(["sprint-1", "sprint-2", "sprint-3"]);
  });

  it("AC2: idempotent — calling twice does not create duplicates", () => {
    ensureSprintMilestones(store, ["sprint-1"]);
    const created = ensureSprintMilestones(store, ["sprint-1"]);

    expect(created).toBe(0); // no new milestones on second call
    const milestones = store.getAllNodes().filter(
      (n) => n.type === "milestone" && n.metadata?.sprintLabel === "sprint-1",
    );
    expect(milestones).toHaveLength(1);
  });

  it("AC2: idempotent — partial overlap creates only missing labels", () => {
    ensureSprintMilestones(store, ["sprint-1"]);
    const created = ensureSprintMilestones(store, ["sprint-1", "sprint-2"]);

    expect(created).toBe(1); // only sprint-2 is new
    const milestones = store.getAllNodes().filter((n) => n.type === "milestone");
    expect(milestones).toHaveLength(2);
  });

  it("AC3: sprint milestone nodes have type=milestone and sprintLabel metadata", () => {
    ensureSprintMilestones(store, ["sprint-alpha"]);

    const node = store.getAllNodes().find(
      (n) => n.type === "milestone" && n.metadata?.sprintLabel === "sprint-alpha",
    );
    expect(node).toBeDefined();
    expect(node!.type).toBe("milestone");
    expect(node!.metadata?.sprintLabel).toBe("sprint-alpha");
    expect(node!.metadata?.autoCreated).toBe(true);
  });

  it("does nothing when sprint labels array is empty", () => {
    const created = ensureSprintMilestones(store, []);
    expect(created).toBe(0);
    const milestones = store.getAllNodes().filter((n) => n.type === "milestone");
    expect(milestones).toHaveLength(0);
  });

  it("extracts sprint labels from nodes and creates milestones (integration)", () => {
    // Simulate what import_prd does: nodes with sprint annotations
    const nodes: GraphNode[] = [
      makeTaskNode({ sprint: "sprint-1" }),
      makeTaskNode({ sprint: "sprint-1" }),
      makeTaskNode({ sprint: "sprint-2" }),
      makeTaskNode({ sprint: undefined }),
    ];

    const sprintLabels = [...new Set(nodes.map((n) => n.sprint).filter(Boolean))] as string[];
    const created = ensureSprintMilestones(store, sprintLabels);

    expect(created).toBe(2);
    const milestones = store.getAllNodes().filter((n) => n.type === "milestone");
    expect(milestones).toHaveLength(2);
  });
});
