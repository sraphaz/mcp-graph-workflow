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
 * BUG-04 observation: tasks can carry sprint label even when no sprint node exists.
 * Verifies the sprint field is persisted on tasks correctly.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore } from "./helpers/test-store.js";
import { makeNode } from "./helpers/factories.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";

describe("tasks can have sprint field without a sprint node", () => {
  let store: SqliteStore;
  let cleanup: () => void;

  beforeEach(() => {
    const ctx = createTestStore("sprint-field-test");
    store = ctx.store;
    cleanup = ctx.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("should persist sprint field on task node", () => {
    // Arrange
    const node = makeNode({ sprint: "sprint-1" });

    // Act
    store.insertNode(node);
    const retrieved = store.getNodeById(node.id);

    // Assert
    expect(retrieved).not.toBeNull();
    expect(retrieved?.sprint).toBe("sprint-1");
  });

  it("should allow multiple tasks with same sprint label", () => {
    // Arrange
    const nodeA = makeNode({ sprint: "sprint-1" });
    const nodeB = makeNode({ sprint: "sprint-1" });
    const nodeC = makeNode({ sprint: "sprint-1" });

    // Act
    store.insertNode(nodeA);
    store.insertNode(nodeB);
    store.insertNode(nodeC);
    const all = store.getAllNodes();
    const sprintTasks = all.filter((n) => n.sprint === "sprint-1");

    // Assert — 3 tasks with sprint label, no sprint entity node required
    expect(sprintTasks).toHaveLength(3);
  });

  it("should return sprint field via getNodesByStatus", () => {
    // Arrange
    const node = makeNode({ status: "backlog", sprint: "sprint-1" });
    store.insertNode(node);

    // Act
    const results = store.getNodesByStatus("backlog");

    // Assert
    expect(results[0].sprint).toBe("sprint-1");
  });
});
