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

/**
 * BUG-04 symptom: metrics(stats).sprintCount → 0 when tasks have sprint field but are not done.
 * calculateVelocity only groups done tasks by sprint — backlog/in_progress tasks are excluded.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore } from "./helpers/test-store.js";
import { makeNode } from "./helpers/factories.js";
import { calculateVelocity } from "../core/planner/velocity.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";

describe("sprintCount reflects done tasks grouped by sprint", () => {
  let store: SqliteStore;
  let cleanup: () => void;

  beforeEach(() => {
    const ctx = createTestStore("sprint-count-test");
    store = ctx.store;
    cleanup = ctx.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("should return sprintCount=0 when sprint tasks are not done", () => {
    // Arrange — tasks have sprint label but are in backlog
    const nodeA = makeNode({ sprint: "sprint-1", status: "backlog" });
    const nodeB = makeNode({ sprint: "sprint-1", status: "in_progress" });
    store.insertNode(nodeA);
    store.insertNode(nodeB);

    // Act
    const doc = store.toGraphDocument();
    const velocity = calculateVelocity(doc);

    // Assert — sprintCount = 0 because no done tasks exist
    expect(velocity.sprints).toHaveLength(0);
  });

  it("should return sprintCount=1 when at least one done task has sprint label", () => {
    // Arrange
    const node = makeNode({ sprint: "sprint-1", status: "backlog" });
    store.insertNode(node);
    store.updateNodeStatus(node.id, "in_progress");
    store.updateNodeStatus(node.id, "done");

    // Act
    const doc = store.toGraphDocument();
    const velocity = calculateVelocity(doc);

    // Assert — 1 sprint group because 1 done task has sprint: "sprint-1"
    expect(velocity.sprints).toHaveLength(1);
    expect(velocity.sprints[0].sprint).toBe("sprint-1");
    expect(velocity.sprints[0].tasksCompleted).toBe(1);
  });

  it("should group multiple done tasks into same sprint entry", () => {
    // Arrange
    const nodeA = makeNode({ sprint: "sprint-1", status: "backlog" });
    const nodeB = makeNode({ sprint: "sprint-1", status: "backlog" });
    store.insertNode(nodeA);
    store.insertNode(nodeB);
    store.updateNodeStatus(nodeA.id, "in_progress");
    store.updateNodeStatus(nodeA.id, "done");
    store.updateNodeStatus(nodeB.id, "in_progress");
    store.updateNodeStatus(nodeB.id, "done");

    // Act
    const doc = store.toGraphDocument();
    const velocity = calculateVelocity(doc);

    // Assert — 1 sprint group with 2 completed tasks
    expect(velocity.sprints).toHaveLength(1);
    expect(velocity.sprints[0].tasksCompleted).toBe(2);
  });
});
