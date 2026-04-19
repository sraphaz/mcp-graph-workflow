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

describe("restoreSnapshot schema validation (E1-T11)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  function createSnapshotWithNodes(): number {
    const n1 = makeNode({ title: "Valid Node 1" });
    const n2 = makeNode({ title: "Valid Node 2" });
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertEdge(makeEdge(n1.id, n2.id));
    return store.createSnapshot();
  }

  // ── AC1: each node validated with GraphNodeSchema before insert ──

  describe("node validation", () => {
    it("should restore valid nodes successfully", () => {
      const snapshotId = createSnapshotWithNodes();

      // Delete current nodes then restore
      store.bulkInsert([], []); // no-op, just to have the method available
      const db = (store as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare("DELETE FROM edges WHERE 1=1").run();
      db.prepare("DELETE FROM nodes WHERE 1=1").run();

      expect(store.getAllNodes()).toHaveLength(0);

      const result = store.restoreSnapshot(snapshotId);

      expect(store.getAllNodes()).toHaveLength(2);
      // Should return restore report
      expect(result).toBeDefined();
      expect(result.nodesValid).toBe(2);
      expect(result.nodesInvalid).toBe(0);
    });
  });

  // ── AC2: invalid nodes logged and skipped ──

  describe("invalid node handling", () => {
    it("should skip invalid nodes and restore valid ones", () => {
      // Create a snapshot, then corrupt a node in the snapshot data
      const n1 = makeNode({ title: "Good Node" });
      store.insertNode(n1);
      const snapshotId = store.createSnapshot();

      // Corrupt the snapshot data to include an invalid node (missing required fields)
      const db = (store as unknown as { db: { prepare: (sql: string) => { get: (...args: unknown[]) => { data: string } | undefined; run: (...args: unknown[]) => void } } }).db;
      const row = db.prepare("SELECT data FROM snapshots WHERE rowid = ?").get(snapshotId) as { data: string };
      const doc = JSON.parse(row.data);

      // Add an invalid node (missing title, type, etc.)
      doc.nodes.push({
        id: "invalid_node_1",
        // Missing required: type, title, status, priority, createdAt, updatedAt
      });

      // Add another invalid node (bad status value)
      doc.nodes.push({
        id: "invalid_node_2",
        type: "task",
        title: "Bad Status",
        status: "NOT_A_VALID_STATUS",
        priority: 3,
        blocked: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      db.prepare("UPDATE snapshots SET data = ? WHERE rowid = ?").run(JSON.stringify(doc), snapshotId);

      // Clear current data
      db.prepare("DELETE FROM edges WHERE 1=1").run();
      db.prepare("DELETE FROM nodes WHERE 1=1").run();

      const result = store.restoreSnapshot(snapshotId);

      // Only the valid node should be restored
      expect(store.getAllNodes()).toHaveLength(1);
      expect(store.getAllNodes()[0].title).toBe("Good Node");

      // Report should show 1 valid, 2 invalid
      expect(result.nodesValid).toBe(1);
      expect(result.nodesInvalid).toBe(2);
    });
  });

  // ── AC3: restore reports count of valid vs invalid nodes ──

  describe("restore report", () => {
    it("should report counts for all-valid snapshot", () => {
      const snapshotId = createSnapshotWithNodes();

      const result = store.restoreSnapshot(snapshotId);

      expect(result).toEqual(
        expect.objectContaining({
          nodesValid: 2,
          nodesInvalid: 0,
        }),
      );
    });

    it("should report edge counts too", () => {
      const snapshotId = createSnapshotWithNodes();

      const result = store.restoreSnapshot(snapshotId);

      expect(result.edgesRestored).toBe(1);
    });
  });
});
