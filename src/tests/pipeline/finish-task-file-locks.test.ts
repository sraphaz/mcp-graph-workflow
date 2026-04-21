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
import { finishTask } from "../../core/pipeline/finish-task.js";
import { makeNode, makeEpic } from "../helpers/factories.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function setupStore(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("Finish Task Lock Test");
  const epic = makeEpic({ title: "Epic" });
  store.insertNode(epic);
  return store;
}

function addInProgressNode(store: SqliteStore): string {
  const epic = store.toGraphDocument().nodes.find((n) => n.type === "epic")!;
  const node = makeNode({
    title: "Task with description",
    parentId: epic.id,
    status: "backlog",
    description: "Implements something concrete",
    acceptanceCriteria: ["GIVEN X WHEN Y THEN Z result equals 42"],
    xpSize: "S" as const,
  });
  store.insertNode(node);
  store.updateNodeStatus(node.id, "in_progress");
  return node.id;
}

// ── AC 1: metadata._fileLeases released on done ────────────────────────────

describe("finishTask file locks (AC 1 — release _fileLeases on done)", () => {
  let store: SqliteStore;
  let lockManager: LockManager;

  beforeEach(() => {
    store = setupStore();
    lockManager = new LockManager(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should release file locks stored in metadata._fileLeases when status becomes done", async () => {
    const nodeId = addInProgressNode(store);

    // Acquire file locks and store their tokens in node metadata
    const lock1 = lockManager.acquire("file:src/foo.ts", "agent-1", 600);
    const lock2 = lockManager.acquire("file:src/bar.ts", "agent-1", 600);

    store.updateNode(nodeId, {
      metadata: { _fileLeases: [lock1.leaseToken, lock2.leaseToken] },
    });

    await finishTask(store, nodeId, {
      rationale: "done",
      agentId: "agent-1",
      lockManager,
    });

    // File locks should be released — not active any more
    const active = lockManager.listActive().filter((l) => l.resourceId.startsWith("file:"));
    expect(active).toHaveLength(0);
  });

  it("should handle gracefully when _fileLeases is missing from metadata", async () => {
    const nodeId = addInProgressNode(store);
    // No _fileLeases in metadata
    store.updateNode(nodeId, { metadata: {} });

    await expect(
      finishTask(store, nodeId, {
        rationale: "done",
        lockManager,
      }),
    ).resolves.not.toThrow();
  });

  it("should handle gracefully when a lease token is already expired/released", async () => {
    const nodeId = addInProgressNode(store);
    const staleToken = "stale-token-that-does-not-exist";

    store.updateNode(nodeId, {
      metadata: { _fileLeases: [staleToken] },
    });

    // Should not throw even if the lock is already gone
    await expect(
      finishTask(store, nodeId, { rationale: "done", lockManager }),
    ).resolves.not.toThrow();
  });
});

// ── AC 2: git diff --name-only harvested to touchedFilesObserved ───────────

describe("finishTask git harvest (AC 2 — touchedFilesObserved)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = setupStore();
  });

  afterEach(() => {
    store.close();
  });

  it("should set touchedFilesObserved in metadata after done (array, possibly empty)", async () => {
    const nodeId = addInProgressNode(store);

    await finishTask(store, nodeId, { rationale: "done" });

    const node = store.getNodeById(nodeId);
    expect(node?.metadata).toBeDefined();
    expect(Array.isArray(node?.metadata?.touchedFilesObserved)).toBe(true);
  });

  it("should not throw even when git is not available in the test environment", async () => {
    const nodeId = addInProgressNode(store);

    await expect(
      finishTask(store, nodeId, { rationale: "done" }),
    ).resolves.not.toThrow();
  });
});

// ── AC 3: no orphan file locks after happy-path finish ────────────────────

describe("finishTask file locks (AC 3 — no orphan locks after happy-path)", () => {
  let store: SqliteStore;
  let lockManager: LockManager;

  beforeEach(() => {
    store = setupStore();
    lockManager = new LockManager(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should leave no active file:* locks after successful finish", async () => {
    const nodeId = addInProgressNode(store);

    const lock1 = lockManager.acquire("file:src/alpha.ts", "agent-2", 600);
    const lock2 = lockManager.acquire("file:src/beta.ts", "agent-2", 600);
    const lock3 = lockManager.acquire("file:src/gamma.ts", "agent-2", 600);

    store.updateNode(nodeId, {
      metadata: { _fileLeases: [lock1.leaseToken, lock2.leaseToken, lock3.leaseToken] },
    });

    const result = await finishTask(store, nodeId, {
      rationale: "done",
      agentId: "agent-2",
      lockManager,
    });

    expect(result.status).toBe("done");

    const orphans = lockManager.listActive().filter((l) => l.resourceId.startsWith("file:"));
    expect(orphans).toHaveLength(0);
  });

  it("should release all file locks regardless of how many are stored", async () => {
    const nodeId = addInProgressNode(store);

    // Acquire 5 file locks
    const tokens: string[] = [];
    for (let i = 0; i < 5; i++) {
      const lock = lockManager.acquire(`file:src/file-${i}.ts`, "agent-3", 600);
      tokens.push(lock.leaseToken);
    }

    store.updateNode(nodeId, { metadata: { _fileLeases: tokens } });

    await finishTask(store, nodeId, {
      rationale: "done",
      agentId: "agent-3",
      lockManager,
    });

    const remaining = lockManager.listActive().filter((l) => l.resourceId.startsWith("file:"));
    expect(remaining).toHaveLength(0);
  });
});
