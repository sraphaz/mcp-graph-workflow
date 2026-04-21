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
 * Task: Commit J — E2E multi-agent integration test — node_5375d7ec7e3a
 *
 * AC1: 5 agents, 5 tasks (3 sharing sandbox.ts): exactly 1 succeeds on shared file.
 * AC2: WIP=3 caps parallel claims.
 * AC3: Partial overlap lists only intersection in conflictingFiles.
 * AC4: Stale lock cleanup allows re-claim.
 * AC5: 10 scenarios from plan all covered.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { LockManager } from "../core/store/lock-manager.js";
import { startTask } from "../core/pipeline/start-task.js";
import { WIPLimitError, FileConflictError } from "../core/utils/errors.js";
import { makeNode, makeEpic } from "./helpers/factories.js";

const SANDBOX = "src/sandbox.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupStore(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("Multi-Agent E2E");
  const epic = makeEpic({ title: "Multi-Agent Epic" });
  store.insertNode(epic);
  return store;
}

function addTask(store: SqliteStore, title: string): string {
  const epicId = store.toGraphDocument().nodes.find((n) => n.type === "epic")!.id;
  const node = makeNode({ title, parentId: epicId, status: "backlog" });
  store.insertNode(node);
  return node.id;
}

function addInProgressTask(store: SqliteStore, title: string): string {
  const id = addTask(store, title);
  store.updateNodeStatus(id, "in_progress");
  return id;
}

function claimTask(
  store: SqliteStore,
  lockManager: LockManager,
  nodeId: string,
  agentId: string,
  touchedFiles: string[],
  wipStrict = true,
): ReturnType<typeof startTask> {
  return startTask(store, {
    nodeId,
    autoStart: true,
    agentId,
    lockManager,
    wipStrict,
    wipLimit: 3,
    touchedFiles,
  });
}

// ── AC1: 3 tasks sharing sandbox.ts — exactly 1 agent succeeds ───────────────

describe("AC1: shared file — exactly 1 agent succeeds (scenarios 1-4)", () => {
  let store: SqliteStore;
  let lockManager: LockManager;
  let task1Id: string;
  let task2Id: string;
  let task3Id: string;

  beforeEach(() => {
    store = setupStore();
    lockManager = new LockManager(store.getDb());
    task1Id = addTask(store, "Task-1-sandbox");
    task2Id = addTask(store, "Task-2-sandbox");
    task3Id = addTask(store, "Task-3-sandbox");
  });

  afterEach(() => store.close());

  // Scenario 1
  it("should allow the first agent to claim a task touching sandbox.ts", () => {
    const result = claimTask(store, lockManager, task1Id, "agent-1", [SANDBOX]);
    expect(result).not.toBeNull();
    expect(store.getNodeById(task1Id)!.status).toBe("in_progress");
  });

  // Scenario 2
  it("should throw FileConflictError when agent-2 claims task2 (sandbox.ts locked)", () => {
    claimTask(store, lockManager, task1Id, "agent-1", [SANDBOX]);

    expect(() =>
      claimTask(store, lockManager, task2Id, "agent-2", [SANDBOX]),
    ).toThrow(FileConflictError);
  });

  // Scenario 3
  it("should throw FileConflictError when agent-3 claims task3 (sandbox.ts still locked)", () => {
    claimTask(store, lockManager, task1Id, "agent-1", [SANDBOX]);

    expect(() =>
      claimTask(store, lockManager, task3Id, "agent-3", [SANDBOX]),
    ).toThrow(FileConflictError);
  });

  // Scenario 4
  it("should have exactly one active file lock on sandbox.ts after 3 claim attempts", () => {
    claimTask(store, lockManager, task1Id, "agent-1", [SANDBOX]);

    try { claimTask(store, lockManager, task2Id, "agent-2", [SANDBOX]); } catch { /* expected */ }
    try { claimTask(store, lockManager, task3Id, "agent-3", [SANDBOX]); } catch { /* expected */ }

    const sandboxLocks = lockManager.listActive().filter(
      (l) => l.resourceId === `file:${SANDBOX}`,
    );
    expect(sandboxLocks).toHaveLength(1);
    expect(sandboxLocks[0].agentId).toBe("agent-1");
  });
});

// ── AC2: WIP=3 caps parallel claims ──────────────────────────────────────────

describe("AC2: WIP=3 caps parallel claims (scenarios 5-6)", () => {
  let store: SqliteStore;
  let lockManager: LockManager;

  beforeEach(() => {
    store = setupStore();
    lockManager = new LockManager(store.getDb());
    addInProgressTask(store, "In-Progress-1");
    addInProgressTask(store, "In-Progress-2");
    addInProgressTask(store, "In-Progress-3");
  });

  afterEach(() => store.close());

  // Scenario 5
  it("should throw WIPLimitError when WIP=3 is reached in strict mode", () => {
    const targetId = addTask(store, "Task-4-target");

    expect(() =>
      claimTask(store, lockManager, targetId, "agent-4", [], true),
    ).toThrow(WIPLimitError);
  });

  // Scenario 6
  it("should NOT throw when WIP=3 in advisory mode (wipStrict=false)", () => {
    const targetId = addTask(store, "Task-4-advisory");

    expect(() =>
      claimTask(store, lockManager, targetId, "agent-4", [], false),
    ).not.toThrow();
  });
});

// ── AC3: Partial overlap — conflictingFiles = intersection only ───────────────

describe("AC3: partial overlap — conflictingFiles = intersection only (scenarios 7, 10)", () => {
  let store: SqliteStore;
  let lockManager: LockManager;

  beforeEach(() => {
    store = setupStore();
    lockManager = new LockManager(store.getDb());
  });

  afterEach(() => store.close());

  // Scenario 7
  it("should list only overlapping files in conflictingFiles, not all touched files", () => {
    const task1Id = addTask(store, "Task-1-sandbox-only");
    claimTask(store, lockManager, task1Id, "agent-1", [SANDBOX]);

    const task2Id = addTask(store, "Task-2-sandbox-plus-lib");
    try {
      claimTask(store, lockManager, task2Id, "agent-2", [SANDBOX, "src/lib.ts"]);
      expect.fail("Should have thrown FileConflictError");
    } catch (err) {
      expect(err).toBeInstanceOf(FileConflictError);
      const conflictErr = err as FileConflictError;
      expect(conflictErr.details.conflictingFiles).toContain(SANDBOX);
      expect(conflictErr.details.conflictingFiles).not.toContain("src/lib.ts");
      expect(conflictErr.details.conflictingFiles).toHaveLength(1);
    }
  });

  // Scenario 10
  it("should populate heldBy with the correct agentId in FileConflictError", () => {
    const task1Id = addTask(store, "Task-1-holder");
    claimTask(store, lockManager, task1Id, "agent-1", [SANDBOX]);

    const task2Id = addTask(store, "Task-2-challenger");
    try {
      claimTask(store, lockManager, task2Id, "agent-2", [SANDBOX]);
      expect.fail("Should have thrown FileConflictError");
    } catch (err) {
      expect(err).toBeInstanceOf(FileConflictError);
      const conflictErr = err as FileConflictError;
      expect(conflictErr.details.heldBy.some((h) => h.agentId === "agent-1")).toBe(true);
    }
  });
});

// ── AC4: Stale lock cleanup allows re-claim ───────────────────────────────────

describe("AC4: stale lock cleanup allows re-claim (scenario 8)", () => {
  let store: SqliteStore;
  let lockManager: LockManager;

  beforeEach(() => {
    store = setupStore();
    lockManager = new LockManager(store.getDb());
  });

  afterEach(() => store.close());

  // Scenario 8
  it("should allow re-claim of sandbox.ts after the stale lock expires", () => {
    const task1Id = addTask(store, "Task-1-will-expire");
    claimTask(store, lockManager, task1Id, "agent-1", [SANDBOX]);

    // Manually expire the file lock
    store
      .getDb()
      .prepare("UPDATE resource_locks SET expires_at = ? WHERE resource_id = ?")
      .run(new Date(Date.now() - 60_000).toISOString(), `file:${SANDBOX}`);

    // agent-2 now re-claims (acquire auto-cleans expired locks)
    const task2Id = addTask(store, "Task-2-reclaim");
    expect(() =>
      claimTask(store, lockManager, task2Id, "agent-2", [SANDBOX]),
    ).not.toThrow();

    expect(store.getNodeById(task2Id)!.status).toBe("in_progress");
  });
});

// ── Non-overlapping files succeed in parallel ─────────────────────────────────

describe("Non-overlapping files: agent-5 with unique files (scenario 9)", () => {
  let store: SqliteStore;
  let lockManager: LockManager;

  beforeEach(() => {
    store = setupStore();
    lockManager = new LockManager(store.getDb());
  });

  afterEach(() => store.close());

  // Scenario 9
  it("should allow agent-5 to claim task5 with unique files while agent-1 holds sandbox.ts", () => {
    const task1Id = addTask(store, "Task-1-sandbox");
    claimTask(store, lockManager, task1Id, "agent-1", [SANDBOX]);

    const task5Id = addTask(store, "Task-5-unique");
    const result = claimTask(store, lockManager, task5Id, "agent-5", ["src/unique5.ts"]);

    expect(result).not.toBeNull();
    expect(store.getNodeById(task5Id)!.status).toBe("in_progress");
  });
});
