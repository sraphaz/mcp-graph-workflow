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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { findEnhancedNextTask } from "../core/planner/enhanced-next.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";
import type { GraphNode } from "../core/graph/graph-types.js";

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

describe("findEnhancedNextTask", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return null when no eligible tasks exist", () => {
    const doc = store.toGraphDocument();
    const result = findEnhancedNextTask(doc, store);
    expect(result).toBeNull();
  });

  it("should return enhanced result for available task", () => {
    const node = makeNode({ title: "Build REST API", xpSize: "M" });
    store.insertNode(node);

    const doc = store.toGraphDocument();
    const result = findEnhancedNextTask(doc, store);

    expect(result).not.toBeNull();
    expect(result!.task.node.id).toBe(node.id);
    expect(result!.knowledgeCoverage).toBeGreaterThanOrEqual(0);
    expect(result!.enhancedReason).toBeTruthy();
  });

  it("should report higher knowledge coverage when docs exist", () => {
    const node = makeNode({ title: "Setup Express server", tags: ["express", "api"] });
    store.insertNode(node);

    const knowledgeStore = new KnowledgeStore(store.getDb());
    knowledgeStore.insert({
      sourceType: "docs",
      sourceId: "express-docs",
      title: "Express Guide",
      content: "Express is a web framework for building APIs and server applications",
    });

    const doc = store.toGraphDocument();
    const result = findEnhancedNextTask(doc, store);

    expect(result!.knowledgeCoverage).toBeGreaterThan(0);
  });

  it("should include velocity context when done tasks exist", () => {
    // Add a completed task for velocity baseline
    const done = makeNode({
      title: "Previous task",
      status: "done",
      xpSize: "M",
      createdAt: new Date(Date.now() - 8 * 3600000).toISOString(), // 8 hours ago
      updatedAt: now(),
    });
    store.insertNode(done);

    // Add an eligible task
    const next = makeNode({ title: "Next task", xpSize: "S" });
    store.insertNode(next);

    const doc = store.toGraphDocument();
    const result = findEnhancedNextTask(doc, store);

    expect(result).not.toBeNull();
    expect(result!.velocityContext.avgCompletionHours).not.toBeNull();
    expect(result!.velocityContext.estimatedHours).not.toBeNull();
  });
});
