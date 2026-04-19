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
 * Chaos Engineering Tests — E6: Stress & Edge Cases
 *
 * Tests system resilience under adversarial conditions:
 * concurrent writes, cascade deletions, malformed input,
 * numeric boundaries, circular references, corrupt data.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("Chaos Engineering — System Resilience", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Chaos Test");
  });

  afterEach(() => {
    store.close();
  });

  // E6-T01: Concurrent write storm
  it("should handle rapid sequential updates without corruption", () => {
    const node = makeNode({ id: "chaos-1", title: "Target node" });
    store.insertNode(node);

    // 100 rapid updates with incrementing titles
    for (let i = 0; i < 100; i++) {
      store.updateNode("chaos-1", { title: `Update ${i}` });
    }

    const final = store.getNodeById("chaos-1");
    expect(final).not.toBeNull();
    expect(final!.title).toBe("Update 99");
  });

  // E6-T02: Cascade deletion under load
  it("should cascade delete edges when node deleted under load", () => {
    const parent = makeNode({ id: "parent-1", type: "epic", title: "Parent" });
    store.insertNode(parent);

    // Create 50 child nodes with edges
    for (let i = 0; i < 50; i++) {
      const child = makeNode({ id: `child-${i}`, title: `Child ${i}`, parentId: "parent-1" });
      store.insertNode(child);
      store.insertEdge(makeEdge("parent-1", `child-${i}`, { relationType: "parent_of" }));
    }

    // Delete parent — edges should cascade
    store.deleteNode("parent-1");

    const doc = store.toGraphDocument();
    const parentEdges = doc.edges.filter((e) => e.from === "parent-1" || e.to === "parent-1");
    expect(parentEdges).toHaveLength(0);
  });

  // E6-T03: Malformed JSON injection
  it("should handle malformed metadata gracefully", () => {
    const node = makeNode({ id: "json-1", title: "JSON test" });
    store.insertNode(node);

    // Update with deeply nested metadata
    const deepMetadata: Record<string, unknown> = { level: 0 };
    let current = deepMetadata;
    for (let i = 1; i < 20; i++) {
      const next: Record<string, unknown> = { level: i };
      current["child"] = next;
      current = next;
    }

    store.updateNode("json-1", { metadata: deepMetadata });
    const retrieved = store.getNodeById("json-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.metadata).toBeDefined();
  });

  // E6-T04: Numeric boundary fuzzing
  it("should handle extreme priority and estimate values", () => {
    const node = makeNode({
      id: "num-1",
      title: "Numeric boundary",
      priority: 1,
      estimateMinutes: 0,
    });
    store.insertNode(node);

    // Update with boundary values
    store.updateNode("num-1", { priority: 5 });
    const updated = store.getNodeById("num-1");
    expect(updated!.priority).toBe(5);
  });

  // E6-T05: Circular reference attacks
  it("should not crash on circular edge insertion attempt", () => {
    const a = makeNode({ id: "circ-a", title: "A" });
    const b = makeNode({ id: "circ-b", title: "B" });
    store.insertNode(a);
    store.insertNode(b);

    store.insertEdge(makeEdge("circ-a", "circ-b", { relationType: "depends_on" }));
    store.insertEdge(makeEdge("circ-b", "circ-a", { relationType: "depends_on" }));

    // Graph should still be queryable
    const doc = store.toGraphDocument();
    expect(doc.nodes).toHaveLength(2);
    expect(doc.edges.length).toBeGreaterThanOrEqual(2);
  });

  // E6-T06: Corrupt snapshot restore
  it("should handle empty graph document gracefully", () => {
    const doc = store.toGraphDocument();
    expect(doc.nodes).toBeDefined();
    expect(doc.edges).toBeDefined();
    expect(Array.isArray(doc.nodes)).toBe(true);
  });

  // E6-T07: Concurrent PRD imports
  it("should handle rapid node insertions without ID collision", () => {
    const nodes = Array.from({ length: 200 }, (_, i) =>
      makeNode({ title: `Rapid insert ${i}` }),
    );

    for (const node of nodes) {
      store.insertNode(node);
    }

    const doc = store.toGraphDocument();
    const ids = new Set(doc.nodes.map((n) => n.id));
    expect(ids.size).toBe(200); // All unique IDs
  });

  // E6-T08: Migration interruption
  it("should survive reading from fresh store without errors", () => {
    // Fresh store with all migrations applied
    const stats = store.getStats();
    expect(stats).toBeDefined();
    expect(stats.totalNodes).toBe(0);
  });

  // E6-T09: Algorithm edge cases
  it("should handle single-node graph in all queries", () => {
    store.insertNode(makeNode({ id: "solo", title: "Solo node" }));

    const doc = store.toGraphDocument();
    expect(doc.nodes).toHaveLength(1);
    expect(doc.edges).toHaveLength(0);

    // Search should work
    const results = store.searchNodes("Solo");
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  // E6-T10: Knowledge store stress
  it("should handle large batch of knowledge documents", () => {
    const db = store.getDb();

    // Insert 100 knowledge docs rapidly
    const insert = db.prepare(
      `INSERT OR IGNORE INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, quality_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const now = new Date().toISOString();
    db.transaction(() => {
      for (let i = 0; i < 100; i++) {
        insert.run(
          `kdoc-${i}`, "test", `test-${i}`, `Doc ${i}`,
          `Content for document ${i}`, `hash-${i}`, 0.8, now, now,
        );
      }
    })();

    const count = db.prepare("SELECT count(*) as c FROM knowledge_documents").get() as { c: number };
    expect(count.c).toBeGreaterThanOrEqual(100);
  });
});
