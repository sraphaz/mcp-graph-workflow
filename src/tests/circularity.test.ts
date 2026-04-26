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

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { checkCircularity } from "../core/utils/circularity.js";
import type { GraphNode } from "../core/graph/graph-types.js";

function makeNode(id: string, parentId?: string | null): GraphNode {
  const now = new Date().toISOString();
  return {
    id,
    type: "task",
    title: `Node ${id}`,
    status: "backlog",
    priority: 3,
    parentId: parentId ?? null,
    blocked: false,
    createdAt: now,
    updatedAt: now,
  } as unknown as GraphNode;
}

describe("checkCircularity", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("circ-test");
  });

  it("should return null when parentId is null/undefined (no parent change)", () => {
    expect(checkCircularity(store, "n1", null)).toBeNull();
    expect(checkCircularity(store, "n1", undefined)).toBeNull();
  });

  it("should reject self-parenting with a descriptive error", () => {
    const result = checkCircularity(store, "n1", "n1");
    expect(result).toBe("A node cannot be its own parent");
  });

  it("should return null when there is no relationship between nodes", () => {
    store.insertNode(makeNode("a"));
    store.insertNode(makeNode("b"));

    expect(checkCircularity(store, "a", "b")).toBeNull();
  });

  it("should detect a direct circular reference (B has parent A; trying to set A.parent=B)", () => {
    store.insertNode(makeNode("a"));
    store.insertNode(makeNode("b", "a"));

    const result = checkCircularity(store, "a", "b");
    expect(result).toMatch(/Circular reference detected/);
  });

  it("should detect a transitive circular reference (A→B→C, trying to set A.parent=C)", () => {
    store.insertNode(makeNode("a"));
    store.insertNode(makeNode("b", "a"));
    store.insertNode(makeNode("c", "b"));

    const result = checkCircularity(store, "a", "c");
    expect(result).toMatch(/Circular reference detected/);
  });

  it("should walk up to root without crashing when ancestor chain ends at a missing node", () => {
    // Insert a node whose parentId points to a non-existent ancestor.
    // checkCircularity should treat the chain as broken and return null.
    store.insertNode(makeNode("orphan-parent", "ghost-ancestor"));

    expect(checkCircularity(store, "n1", "orphan-parent")).toBeNull();
  });

  it("should return null when prospective parent's ancestors do not include nodeId", () => {
    store.insertNode(makeNode("root"));
    store.insertNode(makeNode("mid", "root"));
    store.insertNode(makeNode("leaf", "mid"));
    store.insertNode(makeNode("standalone"));

    expect(checkCircularity(store, "standalone", "leaf")).toBeNull();
  });
});
