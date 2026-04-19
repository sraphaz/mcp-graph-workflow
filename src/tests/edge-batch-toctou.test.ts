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
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("Edge batch TOCTOU fix (E4-T02)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  // ── AC1: node existence checks inside transaction ──

  describe("node existence validated atomically with insert", () => {
    it("should not insert edge if from_node is deleted between check and insert", () => {
      const n1 = makeNode({ title: "Source" });
      const n2 = makeNode({ title: "Target" });
      store.insertNode(n1);
      store.insertNode(n2);

      // Delete n1 — simulates concurrent deletion
      store.deleteNode(n1.id);

      // Edge insert should fail because from_node no longer exists
      // With FK constraints + transaction, this should be rejected
      const edge = makeEdge(n1.id, n2.id);
      store.insertEdge(edge);

      // Edge should NOT exist (FK violation, INSERT OR IGNORE skips it)
      const edges = store.getAllEdges();
      expect(edges).toHaveLength(0);
    });

    it("should not insert edge if to_node is deleted between check and insert", () => {
      const n1 = makeNode({ title: "Source" });
      const n2 = makeNode({ title: "Target" });
      store.insertNode(n1);
      store.insertNode(n2);

      // Delete n2
      store.deleteNode(n2.id);

      const edge = makeEdge(n1.id, n2.id);
      store.insertEdge(edge);

      // Edge should NOT exist
      const edges = store.getAllEdges();
      expect(edges).toHaveLength(0);
    });
  });

  // ── AC2: concurrent edge+delete operations handled safely ──

  describe("batch edge insert with concurrent deletes", () => {
    it("should handle batch insert where some nodes were deleted", () => {
      const n1 = makeNode({ title: "Node 1" });
      const n2 = makeNode({ title: "Node 2" });
      const n3 = makeNode({ title: "Node 3" });
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertNode(n3);

      // Delete n2 — simulates concurrent deletion
      store.deleteNode(n2.id);

      // Batch insert: n1→n2 (invalid, n2 deleted), n1→n3 (valid)
      const e1 = makeEdge(n1.id, n2.id);
      const e2 = makeEdge(n1.id, n3.id);
      store.mergeInsert([], [e1, e2]);

      // Only the valid edge should exist
      const edges = store.getAllEdges();
      expect(edges).toHaveLength(1);
      expect(edges[0].to).toBe(n3.id);
    });

    it("should maintain data integrity after delete+insert sequence", () => {
      const n1 = makeNode({ title: "A" });
      const n2 = makeNode({ title: "B" });
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertEdge(makeEdge(n1.id, n2.id));

      // Delete n2 — cascading should delete the edge too
      store.deleteNode(n2.id);

      // Verify clean state
      expect(store.getAllEdges()).toHaveLength(0);
      expect(store.getAllNodes()).toHaveLength(1);
    });
  });
});
