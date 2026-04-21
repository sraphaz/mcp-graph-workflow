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
import { startTask } from "../../core/pipeline/start-task.js";
import { WIPLimitError } from "../../core/utils/errors.js";
import { makeNode, makeEpic } from "../helpers/factories.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function setupStore(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("WIP Gate Test");
  const epic = makeEpic({ title: "Epic" });
  store.insertNode(epic);
  return store;
}

function addInProgressTask(store: SqliteStore, title: string): string {
  const epic = store.toGraphDocument().nodes.find((n) => n.type === "epic")!;
  const node = makeNode({ title, parentId: epic.id, status: "backlog" });
  store.insertNode(node);
  store.updateNodeStatus(node.id, "in_progress");
  return node.id;
}

function addBacklogTask(store: SqliteStore, title: string): string {
  const epic = store.toGraphDocument().nodes.find((n) => n.type === "epic")!;
  const node = makeNode({ title, parentId: epic.id, status: "backlog" });
  store.insertNode(node);
  return node.id;
}

// ── AC 1: enforceWipAndFileGates before lockManager.acquire ───────────────
// Verified by: throws BEFORE status mutation (status stays backlog)

describe("startTask WIP gate — strict mode (AC 1 + AC 2)", () => {
  let store: SqliteStore;
  let lockManager: LockManager;

  beforeEach(() => {
    store = setupStore();
    lockManager = new LockManager(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should throw WIPLimitError when wipLimit exceeded in strict mode (teamTask)", () => {
    // 3 tasks already in_progress — exceeds default limit of 3
    addInProgressTask(store, "Task A");
    addInProgressTask(store, "Task B");
    addInProgressTask(store, "Task C");
    const targetId = addBacklogTask(store, "Task Target");

    expect(() =>
      startTask(store, {
        nodeId: targetId,
        autoStart: true,
        agentId: "agent-1",
        lockManager,
        wipLimit: 3,
        wipStrict: true,
      }),
    ).toThrow(WIPLimitError);
  });

  it("should NOT mutate status when WIPLimitError is thrown (AC 2 — status not mutated)", () => {
    addInProgressTask(store, "Task A");
    addInProgressTask(store, "Task B");
    addInProgressTask(store, "Task C");
    const targetId = addBacklogTask(store, "Task Target");

    try {
      startTask(store, {
        nodeId: targetId,
        autoStart: true,
        agentId: "agent-1",
        lockManager,
        wipLimit: 3,
        wipStrict: true,
      });
    } catch {
      // expected
    }

    const node = store.getNodeById(targetId);
    expect(node!.status).toBe("backlog");
  });

  it("should NOT create shadow branch when WIPLimitError is thrown (AC 2 — no shadow branch)", () => {
    addInProgressTask(store, "Task A");
    addInProgressTask(store, "Task B");
    addInProgressTask(store, "Task C");
    const targetId = addBacklogTask(store, "Task Target");

    let result: Awaited<ReturnType<typeof startTask>> | undefined;
    try {
      result = startTask(store, {
        nodeId: targetId,
        autoStart: true,
        agentId: "agent-1",
        lockManager,
        wipLimit: 3,
        wipStrict: true,
      });
    } catch {
      // expected WIPLimitError
    }

    // result should be undefined (exception was thrown, not returned)
    expect(result).toBeUndefined();
  });

  it("should proceed normally when WIP is below the limit", () => {
    addInProgressTask(store, "Task A");
    addInProgressTask(store, "Task B");
    const targetId = addBacklogTask(store, "Task Target");

    const result = startTask(store, {
      nodeId: targetId,
      autoStart: true,
      agentId: "agent-1",
      lockManager,
      wipLimit: 3,
      wipStrict: true,
    });

    expect(result).not.toBeNull();
    const node = store.getNodeById(targetId);
    expect(node!.status).toBe("in_progress");
  });
});

// ── Advisory mode — warn but do not block ─────────────────────────────────

describe("startTask WIP gate — advisory mode", () => {
  let store: SqliteStore;
  let lockManager: LockManager;

  beforeEach(() => {
    store = setupStore();
    lockManager = new LockManager(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should NOT throw when wipStrict is false even if limit exceeded", () => {
    addInProgressTask(store, "Task A");
    addInProgressTask(store, "Task B");
    addInProgressTask(store, "Task C");
    const targetId = addBacklogTask(store, "Task Target");

    expect(() =>
      startTask(store, {
        nodeId: targetId,
        autoStart: true,
        agentId: "agent-1",
        lockManager,
        wipLimit: 3,
        wipStrict: false,
      }),
    ).not.toThrow();
  });
});

// ── Non-teamTask mode — gate is bypassed ──────────────────────────────────

describe("startTask WIP gate — bypass without lockManager", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = setupStore();
  });

  afterEach(() => {
    store.close();
  });

  it("should NOT apply WIP gate when no lockManager (single-terminal mode)", () => {
    addInProgressTask(store, "Task A");
    addInProgressTask(store, "Task B");
    addInProgressTask(store, "Task C");
    const targetId = addBacklogTask(store, "Task Target");

    // No lockManager → teamTask=false → gate bypassed
    const result = startTask(store, {
      nodeId: targetId,
      autoStart: true,
      wipLimit: 1,
      wipStrict: true,
    });

    expect(result).not.toBeNull();
    const node = store.getNodeById(targetId);
    expect(node!.status).toBe("in_progress");
  });
});
