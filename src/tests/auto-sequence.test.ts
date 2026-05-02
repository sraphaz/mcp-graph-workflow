/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { sequenceSubtasks } from "../core/graph/auto-sequence.js";

describe("sequenceSubtasks", () => {
  let tmpDir: string;
  let store: SqliteStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "auto-seq-"));
    store = SqliteStore.open(tmpDir);
    store.initProject("test");
  });

  function addNode(id: string, parentId: string | null, createdAt: string): void {
    store.mergeInsert(
      [
        {
          id,
          type: "task",
          title: id,
          status: "backlog",
          priority: 3,
          blocked: false,
          createdAt,
          updatedAt: createdAt,
          parentId: parentId ?? undefined,
        },
      ],
      [],
    );
  }

  it("returns 0 edges + chain when parent has fewer than 2 children", () => {
    addNode("p1", null, "2026-01-01");
    addNode("c1", "p1", "2026-01-02");
    const result = sequenceSubtasks(store, "p1");
    expect(result.edgesCreated).toBe(0);
    expect(result.chain).toEqual(["c1"]);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 0 edges + empty chain when parent has no children", () => {
    addNode("p1", null, "2026-01-01");
    const result = sequenceSubtasks(store, "p1");
    expect(result.edgesCreated).toBe(0);
    expect(result.chain).toEqual([]);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates n-1 depends_on edges for n children", () => {
    addNode("p1", null, "2026-01-01");
    addNode("c1", "p1", "2026-01-02");
    addNode("c2", "p1", "2026-01-03");
    addNode("c3", "p1", "2026-01-04");
    const result = sequenceSubtasks(store, "p1");
    expect(result.edgesCreated).toBe(2);
    expect(result.chain).toEqual(["c1", "c2", "c3"]);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("orders chain by createdAt ascending", () => {
    addNode("p1", null, "2026-01-01");
    addNode("late", "p1", "2026-01-10");
    addNode("early", "p1", "2026-01-02");
    addNode("mid", "p1", "2026-01-05");
    const result = sequenceSubtasks(store, "p1");
    expect(result.chain).toEqual(["early", "mid", "late"]);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("each created edge is depends_on with documented reason", () => {
    addNode("p1", null, "2026-01-01");
    addNode("c1", "p1", "2026-01-02");
    addNode("c2", "p1", "2026-01-03");
    sequenceSubtasks(store, "p1");
    const doc = store.toGraphDocument();
    const autoEdges = doc.edges.filter((e) => e.reason === "Auto-sequenced by parent");
    expect(autoEdges).toHaveLength(1);
    expect(autoEdges[0].relationType).toBe("depends_on");
    expect(autoEdges[0].from).toBe("c2");
    expect(autoEdges[0].to).toBe("c1");
    rmSync(tmpDir, { recursive: true, force: true });
  });
});
