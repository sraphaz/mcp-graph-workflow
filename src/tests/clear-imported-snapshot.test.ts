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
import { makeNode } from "./helpers/factories.js";

describe("clearImportedNodes safety snapshot", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Snapshot Safety Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should create a snapshot before deleting imported nodes", () => {
    // Insert nodes from a source file
    const node1 = makeNode({ title: "Imported 1" });
    const node2 = makeNode({ title: "Imported 2" });
    store.insertNode(node1);
    store.insertNode(node2);

    // Record import history
    store.recordImport("test.md", 2, 0);

    // Mark nodes as from this source file
    const pid = store.getProject()?.id;
    const db = store.getDb();
    db.prepare("UPDATE nodes SET source_file = ? WHERE project_id = ?").run("test.md", pid);

    // Check snapshots before
    const snapshotsBefore = store.listSnapshots();
    const countBefore = snapshotsBefore.length;

    // Clear imported nodes
    store.clearImportedNodes("test.md");

    // Verify snapshot was created
    const snapshotsAfter = store.listSnapshots();
    expect(snapshotsAfter.length).toBe(countBefore + 1);
  });

  it("should preserve deleted nodes in the snapshot", () => {
    const node1 = makeNode({ title: "Will Be Deleted" });
    store.insertNode(node1);

    const pid = store.getProject()?.id;
    const db = store.getDb();
    db.prepare("UPDATE nodes SET source_file = ? WHERE project_id = ?").run("delete-me.md", pid);
    store.recordImport("delete-me.md", 1, 0);

    store.clearImportedNodes("delete-me.md");

    // The snapshot should contain the deleted node
    const snapshots = store.listSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(1);

    // Restore and verify the node exists in the snapshot
    const latestId = snapshots[0].snapshotId;
    store.restoreSnapshot(latestId);

    const doc = store.toGraphDocument();
    const found = doc.nodes.find((n) => n.title === "Will Be Deleted");
    expect(found).toBeDefined();
  });

  it("should still delete nodes correctly after snapshot", () => {
    const node1 = makeNode({ title: "To Delete" });
    const node2 = makeNode({ title: "Keep Me" });
    store.insertNode(node1);
    store.insertNode(node2);

    const pid = store.getProject()?.id;
    const db = store.getDb();
    db.prepare("UPDATE nodes SET source_file = ? WHERE id = ? AND project_id = ?").run("src.md", node1.id, pid);
    store.recordImport("src.md", 1, 0);

    const result = store.clearImportedNodes("src.md");

    expect(result.nodesDeleted).toBe(1);

    // The other node should still exist
    const doc = store.toGraphDocument();
    expect(doc.nodes.find((n) => n.title === "Keep Me")).toBeDefined();
    expect(doc.nodes.find((n) => n.title === "To Delete")).toBeUndefined();
  });
});
