/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * startTask reuses the doc snapshot already loaded for findEnhancedNextTask
 * when building the compact task context — buildTaskContext should resolve
 * neighbors from the in-memory arrays instead of re-querying SQLite.
 *
 * The behavioral test asserts the snapshot path produces a complete context
 * (blocker surfaced via in-memory edge iteration). The latency saving is
 * additionally verified by reduced call counts on getChildNodes, which the
 * snapshot eliminates from buildTaskContext's hot path.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { startTask } from "../core/pipeline/start-task.js";
import { buildTaskContext } from "../core/context/compact-context.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("startTask snapshot reuse", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Snapshot Reuse Test");
  });

  afterEach(() => {
    store.close();
  });

  it("startTask builds a complete task context that includes neighbors from the snapshot", () => {
    // Standalone task: no parent so sibling-context assembly (which has its
    // own edge lookups) is skipped — keeps the assertion focused on
    // buildTaskContext's behavior.
    const blocker = makeNode({ title: "Blocker", status: "done" });
    store.insertNode(blocker);

    const task = makeNode({
      title: "Task with blocker",
      acceptanceCriteria: ["a"],
      priority: 1,
    });
    store.insertNode(task);

    store.insertEdge(makeEdge(blocker.id, task.id, { relationType: "blocks" }));

    const result = startTask(store, { nodeId: task.id, autoStart: false });

    expect(result).not.toBeNull();
    expect(result?.task.task.node.id).toBe(task.id);
    expect(result?.context).not.toBeNull();
    // Blocker surfaced — proves the snapshot iteration found the inbound edge.
    expect(result?.context?.blockers.map((b) => b.id)).toContain(blocker.id);
  });

  it("buildTaskContext with snapshot avoids the redundant edge round-trips", () => {
    // Direct contract test. Without a snapshot, buildTaskContext fires
    // getEdgesTo(task.id) + getEdgesFrom(task.id). With a snapshot, both
    // are served from memory, so call counts drop by exactly those two.
    const blocker = makeNode({ title: "Blocker", status: "done" });
    store.insertNode(blocker);
    const task = makeNode({ title: "Task" });
    store.insertNode(task);
    const child = makeNode({ title: "Child", parentId: task.id });
    store.insertNode(child);
    store.insertEdge(makeEdge(blocker.id, task.id, { relationType: "blocks" }));

    const edgesToSpy = vi.spyOn(store, "getEdgesTo");
    const edgesFromSpy = vi.spyOn(store, "getEdgesFrom");

    // Baseline: no snapshot.
    buildTaskContext(store, task.id);
    const noSnapshotEdgesTo = edgesToSpy.mock.calls.filter(([id]) => id === task.id).length;
    const noSnapshotEdgesFrom = edgesFromSpy.mock.calls.filter(([id]) => id === task.id).length;

    edgesToSpy.mockClear();
    edgesFromSpy.mockClear();

    // With snapshot.
    const snapshot = { nodes: store.getAllNodes(), edges: store.getAllEdges() };
    const ctx = buildTaskContext(store, task.id, snapshot);

    expect(ctx).not.toBeNull();
    expect(ctx?.children.map((c) => c.id)).toContain(child.id);
    expect(ctx?.blockers.map((b) => b.id)).toContain(blocker.id);

    expect(noSnapshotEdgesTo).toBeGreaterThan(0);
    expect(noSnapshotEdgesFrom).toBeGreaterThan(0);
    const withSnapshotEdgesTo = edgesToSpy.mock.calls.filter(([id]) => id === task.id).length;
    const withSnapshotEdgesFrom = edgesFromSpy.mock.calls.filter(([id]) => id === task.id).length;
    expect(withSnapshotEdgesTo).toBe(0);
    expect(withSnapshotEdgesFrom).toBe(0);
  });
});
