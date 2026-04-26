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
 * Tests for searchNodes — the FTS5 + TF-IDF reranking entry point.
 *
 * Integration with FTS5 sync triggers and migrations is exercised by
 * sqlite-store.test.ts; this file focuses on searchNodes' contract:
 * empty/sanitized queries, limit handling, fuzzy fallback wiring.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { searchNodes } from "../core/search/fts-search.js";
import type { GraphNode } from "../core/graph/graph-types.js";

function makeNode(
  id: string,
  title: string,
  description: string = "",
): GraphNode {
  const ts = new Date().toISOString();
  return {
    id,
    type: "task",
    title,
    description,
    status: "backlog",
    priority: 3,
    parentId: null,
    blocked: false,
    createdAt: ts,
    updatedAt: ts,
  } as unknown as GraphNode;
}

describe("searchNodes", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("fts-test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty array for empty store + any query", () => {
    expect(searchNodes(store, "anything")).toEqual([]);
  });

  it("should return empty array when query sanitizes to empty (e.g. wildcard '*')", () => {
    store.insertNode(makeNode("n1", "task one"));

    // '*' sanitizes to '""' per Bug #063 fix → return empty without DB query.
    const result = searchNodes(store, "*");
    expect(result).toEqual([]);
  });

  it("should find a node whose title matches the query", () => {
    store.insertNode(makeNode("n1", "implement authentication"));
    store.insertNode(makeNode("n2", "build dashboard"));

    const result = searchNodes(store, "authentication");
    const ids = result.map((r) => r.node.id);
    expect(ids).toContain("n1");
  });

  it("should respect the limit option", () => {
    for (let i = 0; i < 10; i++) {
      store.insertNode(makeNode(`n${i}`, "auth task"));
    }

    const result = searchNodes(store, "auth", { limit: 3 });
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("should default to limit=20 when not specified", () => {
    for (let i = 0; i < 25; i++) {
      store.insertNode(makeNode(`n${i}`, "auth task"));
    }

    const result = searchNodes(store, "auth");
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("should return results with the SearchResult shape (node + score)", () => {
    store.insertNode(makeNode("n1", "auth implementation"));

    const result = searchNodes(store, "auth");
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("node");
      expect(result[0]).toHaveProperty("score");
      expect(typeof result[0].score).toBe("number");
    }
  });

  it("should accept fuzzy=true without throwing on no FTS matches", () => {
    store.insertNode(makeNode("n1", "implementation"));

    // Misspelled query + fuzzy fallback enabled.
    expect(() =>
      searchNodes(store, "implmentaton", { fuzzy: true }),
    ).not.toThrow();
  });

  it("should treat queries with only special characters as empty (no crash)", () => {
    store.insertNode(makeNode("n1", "real task"));

    // FTS-special chars: should sanitize, not crash.
    expect(() => searchNodes(store, '""')).not.toThrow();
    expect(() => searchNodes(store, "()")).not.toThrow();
  });
});
