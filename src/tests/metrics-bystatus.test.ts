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
 * BUG-01: getStats().byStatus must reflect updateNodeStatus() changes.
 * AC: GIVEN node set to in_progress via updateNodeStatus
 *     WHEN store.getStats() called
 *     THEN byStatus.in_progress === 1
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore } from "./helpers/test-store.js";
import { makeNode } from "./helpers/factories.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";

describe("BUG-01: getStats().byStatus reflects updateNodeStatus()", () => {
  let store: SqliteStore;
  let cleanup: () => void;

  beforeEach(() => {
    const ctx = createTestStore("metrics-bystatus-test");
    store = ctx.store;
    cleanup = ctx.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("should count in_progress node after updateNodeStatus", () => {
    // Arrange
    const node = makeNode({ status: "backlog" });
    store.insertNode(node);

    // Act
    store.updateNodeStatus(node.id, "in_progress");
    const stats = store.getStats();

    // Assert
    expect(stats.byStatus["in_progress"]).toBe(1);
    expect(stats.byStatus["backlog"]).toBeUndefined();
  });

  it("should count done node after two status transitions", () => {
    // Arrange
    const node = makeNode({ status: "backlog" });
    store.insertNode(node);

    // Act
    store.updateNodeStatus(node.id, "in_progress");
    store.updateNodeStatus(node.id, "done");
    const stats = store.getStats();

    // Assert
    expect(stats.byStatus["done"]).toBe(1);
    expect(stats.byStatus["in_progress"]).toBeUndefined();
  });

  it("should aggregate counts across multiple nodes by status", () => {
    // Arrange
    const nodeA = makeNode({ status: "backlog" });
    const nodeB = makeNode({ status: "backlog" });
    const nodeC = makeNode({ status: "backlog" });
    store.insertNode(nodeA);
    store.insertNode(nodeB);
    store.insertNode(nodeC);

    // Act
    store.updateNodeStatus(nodeA.id, "in_progress");
    store.updateNodeStatus(nodeB.id, "done");
    // nodeC stays backlog
    const stats = store.getStats();

    // Assert
    expect(stats.byStatus["backlog"]).toBe(1);
    expect(stats.byStatus["in_progress"]).toBe(1);
    expect(stats.byStatus["done"]).toBe(1);
  });

  it("should return totalNodes matching inserted count", () => {
    // Arrange
    const nodeA = makeNode();
    const nodeB = makeNode();
    store.insertNode(nodeA);
    store.insertNode(nodeB);

    // Act
    const stats = store.getStats();

    // Assert
    expect(stats.totalNodes).toBe(2);
  });
});
