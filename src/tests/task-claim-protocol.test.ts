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
 * TDD tests for Task Claim Protocol — atomic task claiming in teamTask mode.
 *
 * Tests that start_task acquires locks, finish_task verifies ownership,
 * and next excludes locked tasks.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { LockManager } from "../core/store/lock-manager.js";
import { startTask } from "../core/pipeline/start-task.js";
import { finishTask } from "../core/pipeline/finish-task.js";
import { findNextTask } from "../core/planner/next-task.js";
import { findEnhancedNextTask } from "../core/planner/enhanced-next.js";
import { LockConflictError } from "../core/utils/errors.js";
import { makeTask } from "./helpers/factories.js";

function makeDoc(nodes: GraphNode[], edges: GraphEdge[] = []): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "test", name: "Test", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    meta: { sourceFiles: [], lastImport: null },
    nodes,
    edges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
  };
}

function createStoreWithLockManager(): { store: SqliteStore; lockManager: LockManager } {
  const store = SqliteStore.open(":memory:");
  store.initProject("test-project");
  const lockManager = new LockManager(store.getDb());
  return { store, lockManager };
}

describe("Task Claim Protocol", () => {
  let store: SqliteStore;
  let lockManager: LockManager;

  beforeEach(() => {
    const setup = createStoreWithLockManager();
    store = setup.store;
    lockManager = setup.lockManager;
  });

  // ── start_task with teamTask mode ──────────────────────

  describe("start_task claim", () => {
    it("should acquire lock and return leaseToken when teamTask mode is on", async () => {
      store.insertNode(makeTask({ id: "task-1", title: "Implement feature A" }));

      const result = startTask(store, {
        nodeId: "task-1",
        agentId: "agent-1",
        lockManager,
      });

      expect(result).not.toBeNull();
      expect(result!.leaseToken).toBeTruthy();
      expect(result!.startedAt).toBeTruthy();

      // Verify lock exists in DB
      const locks = lockManager.listActive();
      expect(locks).toHaveLength(1);
      expect(locks[0].agentId).toBe("agent-1");
      expect(locks[0].resourceId).toBe("task:task-1");
    });

    it("should NOT return leaseToken when teamTask mode is off (no lockManager)", async () => {
      store.insertNode(makeTask({ id: "task-1", title: "Implement feature A" }));

      const result = startTask(store, { nodeId: "task-1" });

      expect(result).not.toBeNull();
      expect(result!.leaseToken).toBeUndefined();
      expect(result!.startedAt).toBeTruthy();
    });

    it("should throw LockConflictError when another agent already claimed the task", async () => {
      store.insertNode(makeTask({ id: "task-1", title: "Implement feature A" }));

      // Agent-1 claims the task
      startTask(store, {
        nodeId: "task-1",
        agentId: "agent-1",
        lockManager,
      });

      // Reset status so the task is claimable again (lock remains)
      store.updateNodeStatus("task-1", "backlog");

      expect(() => {
        startTask(store, {
          nodeId: "task-1",
          agentId: "agent-2",
          lockManager,
        });
      }).toThrow(LockConflictError);
    });
  });

  // ── finish_task ownership ──────────────────────────────

  describe("finish_task ownership", () => {
    it("should release lock when task owner finishes", async () => {
      store.insertNode(makeTask({ id: "task-1", title: "Implement feature A" }));

      // Agent-1 claims the task
      const startResult = startTask(store, {
        nodeId: "task-1",
        agentId: "agent-1",
        lockManager,
      });

      expect(startResult!.leaseToken).toBeTruthy();

      // Agent-1 finishes
      const finishResult = await finishTask(store, "task-1", {
        agentId: "agent-1",
        leaseToken: startResult!.leaseToken,
        lockManager,
      });

      // Ownership check should pass (no LockConflictError thrown)
      // If done, lock should be released
      if (finishResult.status === "done") {
        const locks = lockManager.listActive();
        const taskLock = locks.find((l) => l.resourceId === "task:task-1");
        expect(taskLock).toBeUndefined();
      }
    });

    it("should throw LockConflictError when non-owner tries to finish", async () => {
      store.insertNode(makeTask({ id: "task-1", title: "Implement feature A" }));

      // Agent-1 claims the task
      startTask(store, {
        nodeId: "task-1",
        agentId: "agent-1",
        lockManager,
      });

      // Agent-2 tries to finish — should fail ownership check
      await expect(async () => {
        await finishTask(store, "task-1", {
          agentId: "agent-2",
          lockManager,
        });
      }).rejects.toThrow(LockConflictError);
    });
  });

  // ── next with lock-aware filtering ─────────────────────

  describe("next lock-aware", () => {
    it("should exclude tasks locked by other agents from next results", async () => {
      const doc = makeDoc([
        makeTask({ id: "task-1", title: "Task A" }),
        makeTask({ id: "task-2", title: "Task B" }),
      ]);

      const result = findNextTask(doc, { lockedTaskIds: new Set(["task-1"]) });

      expect(result).not.toBeNull();
      expect(result!.node.id).toBe("task-2");
    });

    it("should return null when all tasks are locked by other agents", async () => {
      const doc = makeDoc([
        makeTask({ id: "task-1", title: "Task A" }),
      ]);

      const result = findNextTask(doc, { lockedTaskIds: new Set(["task-1"]) });
      expect(result).toBeNull();
    });

    it("should include tasks locked by the calling agent via enhanced-next", async () => {
      store.insertNode(makeTask({ id: "task-1", title: "Task A" }));

      // Lock by agent-1
      lockManager.acquire("task:task-1", "agent-1", 600);

      // Enhanced next for agent-1 should still see task-1 (own lock)
      const doc = store.toGraphDocument();
      const result = findEnhancedNextTask(doc, store, {
        lockManager,
        agentId: "agent-1",
      });

      expect(result).not.toBeNull();
      expect(result!.task.node.id).toBe("task-1");
    });

    it("should exclude tasks locked by other agents via enhanced-next", async () => {
      store.insertNode(makeTask({ id: "task-1", title: "Task A" }));
      store.insertNode(makeTask({ id: "task-2", title: "Task B" }));

      // Lock task-1 by agent-1
      lockManager.acquire("task:task-1", "agent-1", 600);

      // Enhanced next for agent-2 should skip task-1
      const doc = store.toGraphDocument();
      const result = findEnhancedNextTask(doc, store, {
        lockManager,
        agentId: "agent-2",
      });

      expect(result).not.toBeNull();
      expect(result!.task.node.id).toBe("task-2");
    });

    it("should work without lockManager (backward compat)", async () => {
      store.insertNode(makeTask({ id: "task-1", title: "Task A" }));

      const doc = store.toGraphDocument();
      const result = findEnhancedNextTask(doc, store);

      expect(result).not.toBeNull();
      expect(result!.task.node.id).toBe("task-1");
    });
  });
});
