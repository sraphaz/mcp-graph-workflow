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
 * BUG-01 subtask: list(status:in_progress) → correct result count.
 * Verifies store.getNodesByStatus() reflects updateNodeStatus() changes.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore } from "./helpers/test-store.js";
import { makeNode } from "./helpers/factories.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";

describe("list(status:in_progress) returns correct result", () => {
  let store: SqliteStore;
  let cleanup: () => void;

  beforeEach(() => {
    const ctx = createTestStore("list-by-status-test");
    store = ctx.store;
    cleanup = ctx.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("should return 1 in_progress node after updateNodeStatus", () => {
    // Arrange
    const node = makeNode({ status: "backlog" });
    store.insertNode(node);

    // Act
    store.updateNodeStatus(node.id, "in_progress");
    const results = store.getNodesByStatus("in_progress");

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(node.id);
    expect(results[0].status).toBe("in_progress");
  });

  it("should return empty list when no in_progress nodes", () => {
    // Arrange
    const node = makeNode({ status: "backlog" });
    store.insertNode(node);

    // Act
    const results = store.getNodesByStatus("in_progress");

    // Assert
    expect(results).toHaveLength(0);
  });

  it("should not include backlog nodes when filtering for in_progress", () => {
    // Arrange
    const nodeA = makeNode({ status: "backlog" });
    const nodeB = makeNode({ status: "backlog" });
    store.insertNode(nodeA);
    store.insertNode(nodeB);
    store.updateNodeStatus(nodeA.id, "in_progress");

    // Act
    const results = store.getNodesByStatus("in_progress");

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(nodeA.id);
  });

  it("should return empty list after transitioning in_progress node to done", () => {
    // Arrange
    const node = makeNode({ status: "backlog" });
    store.insertNode(node);
    store.updateNodeStatus(node.id, "in_progress");

    // Act
    store.updateNodeStatus(node.id, "done");
    const results = store.getNodesByStatus("in_progress");

    // Assert
    expect(results).toHaveLength(0);
  });
});
