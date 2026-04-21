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
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { LockManager } from "../../core/store/lock-manager.js";
import { findNextTask } from "../../core/planner/next-task.js";
import { findEnhancedNextTask } from "../../core/planner/enhanced-next.js";
import { makeNode, makeEpic } from "../helpers/factories.js";
import type { GraphDocument } from "../../core/graph/graph-types.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeDoc(nodes: ReturnType<typeof makeNode>[]): GraphDocument {
  const epic = makeEpic({ title: "Epic" });
  return { nodes: [epic, ...nodes], edges: [] } as unknown as GraphDocument;
}

// ── AC 1: findNextTask accepts inFlightTouchedFiles ────────────────────────

describe("findNextTask (AC 1 — inFlightTouchedFiles option)", () => {
  it("should accept inFlightTouchedFiles option without throwing", () => {
    const taskA = makeNode({ title: "Task A", priority: 1, metadata: { touchedFiles: ["src/foo.ts"] } });
    const doc = makeDoc([taskA]);

    expect(() =>
      findNextTask(doc, { inFlightTouchedFiles: new Set(["src/foo.ts"]) }),
    ).not.toThrow();
  });

  it("should return a task even when inFlightTouchedFiles is empty", () => {
    const taskA = makeNode({ title: "Task A", priority: 1 });
    const doc = makeDoc([taskA]);

    const result = findNextTask(doc, { inFlightTouchedFiles: new Set() });
    expect(result).not.toBeNull();
    expect(result!.node.id).toBe(taskA.id);
  });
});

// ── AC 2: Overlapping candidates are excluded ─────────────────────────────

describe("findNextTask (AC 2 — overlapping candidates excluded)", () => {
  it("should exclude candidate whose touchedFiles overlaps with inFlightTouchedFiles", () => {
    // Task A overlaps with in-flight files; Task B does not
    const taskA = makeNode({
      title: "Task A",
      priority: 1,
      metadata: { touchedFiles: ["src/foo.ts"] },
    });
    const taskB = makeNode({
      title: "Task B",
      priority: 2,
      metadata: { touchedFiles: ["src/bar.ts"] },
    });
    const doc = makeDoc([taskA, taskB]);

    const result = findNextTask(doc, {
      inFlightTouchedFiles: new Set(["src/foo.ts"]),
    });

    expect(result).not.toBeNull();
    expect(result!.node.id).toBe(taskB.id);
  });

  it("should not exclude candidates with no touchedFiles metadata", () => {
    const taskNoFiles = makeNode({ title: "No Files Task", priority: 3 });
    const doc = makeDoc([taskNoFiles]);

    const result = findNextTask(doc, {
      inFlightTouchedFiles: new Set(["src/anything.ts"]),
    });

    expect(result).not.toBeNull();
    expect(result!.node.id).toBe(taskNoFiles.id);
  });

  it("should return null when all candidates overlap with in-flight files (no fallback)", () => {
    const taskA = makeNode({
      title: "Task A",
      priority: 1,
      metadata: { touchedFiles: ["src/shared.ts"] },
    });
    const doc = makeDoc([taskA]);

    const result = findNextTask(doc, {
      inFlightTouchedFiles: new Set(["src/shared.ts"]),
    });

    expect(result).toBeNull();
  });

  it("should skip a task when ANY of its touchedFiles overlaps (not all required)", () => {
    const taskMultiFiles = makeNode({
      title: "Task Multi",
      priority: 1,
      metadata: { touchedFiles: ["src/alpha.ts", "src/beta.ts", "src/gamma.ts"] },
    });
    const taskSafe = makeNode({
      title: "Task Safe",
      priority: 2,
    });
    const doc = makeDoc([taskMultiFiles, taskSafe]);

    // Only beta.ts is in-flight — enough to exclude taskMultiFiles
    const result = findNextTask(doc, {
      inFlightTouchedFiles: new Set(["src/beta.ts"]),
    });

    expect(result!.node.id).toBe(taskSafe.id);
  });
});

// ── AC 3: enhanced-next populates from lockManager.listActive() ───────────

describe("findEnhancedNextTask (AC 3 — lockManager populates inFlightTouchedFiles)", () => {
  let store: SqliteStore;
  let lockManager: LockManager;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Overlap Test");
    const epic = makeEpic({ title: "Epic" });
    store.insertNode(epic);
  });

  afterEach(() => {
    store.close();
  });

  it("should exclude candidates whose touchedFiles are locked as file:* by other agents", () => {
    lockManager = new LockManager(store.getDb());

    const epic = store.toGraphDocument().nodes.find((n) => n.type === "epic")!;
    const taskA = makeNode({
      title: "Task A",
      priority: 1,
      parentId: epic.id,
      metadata: { touchedFiles: ["src/hot.ts"] },
    });
    const taskB = makeNode({
      title: "Task B",
      priority: 2,
      parentId: epic.id,
    });
    store.insertNode(taskA);
    store.insertNode(taskB);

    // Agent-2 holds a file lock on src/hot.ts
    lockManager.acquire("file:src/hot.ts", "agent-2", 600);

    const doc = store.toGraphDocument();
    const result = findEnhancedNextTask(doc, store, {
      agentId: "agent-1",
      lockManager,
    });

    expect(result).not.toBeNull();
    expect(result!.task.node.id).toBe(taskB.id);
  });

  it("should not exclude tasks when the file lock is held by the same agent", () => {
    lockManager = new LockManager(store.getDb());

    const epic = store.toGraphDocument().nodes.find((n) => n.type === "epic")!;
    const taskA = makeNode({
      title: "Task A",
      priority: 1,
      parentId: epic.id,
      metadata: { touchedFiles: ["src/mine.ts"] },
    });
    store.insertNode(taskA);

    // Same agent holds the lock — should not self-exclude
    lockManager.acquire("file:src/mine.ts", "agent-1", 600);

    const doc = store.toGraphDocument();
    const result = findEnhancedNextTask(doc, store, {
      agentId: "agent-1",
      lockManager,
    });

    expect(result!.task.node.id).toBe(taskA.id);
  });
});

// ── AC 4: Test scenario — overlapping skipped, next-best returned ─────────

describe("findNextTask (AC 4 — scenario: overlap skipped, next-best returned)", () => {
  it("should skip overlapping task and return the next-best candidate", () => {
    // Priority 1: overlaps with in-flight file → should be skipped
    const taskBest = makeNode({
      title: "Best Task",
      priority: 1,
      metadata: { touchedFiles: ["src/conflict.ts"] },
    });
    // Priority 2: no overlap → should be returned as next-best
    const taskSecond = makeNode({
      title: "Second Task",
      priority: 2,
      metadata: { touchedFiles: ["src/safe.ts"] },
    });

    const doc = makeDoc([taskBest, taskSecond]);

    const result = findNextTask(doc, {
      inFlightTouchedFiles: new Set(["src/conflict.ts"]),
    });

    expect(result).not.toBeNull();
    expect(result!.node.title).toBe("Second Task");
    expect(result!.node.id).toBe(taskSecond.id);
  });
});
