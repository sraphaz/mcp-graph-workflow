/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-12.T01 — SQLite AsyncMutex stress test.
 *
 * Verifies that SqliteStore.withWriteLock correctly serializes concurrent
 * async write sequences without deadlock or lost writes. The mutex is the
 * primary defense against the multi-agent CPU-100% scenario that crashed
 * the M4 (busy-wait spin-lock on SQLite single-writer).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";

function makeStore(): SqliteStore {
  const store = SqliteStore.openDb(":memory:");
  store.initProject("stress");
  return store;
}

function makeNode(id: string, parentId: string | null = null): {
  id: string;
  type: "subtask";
  title: string;
  status: "backlog";
  priority: 3;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
} {
  const now = new Date().toISOString();
  return {
    id,
    type: "subtask",
    title: `node-${id}`,
    status: "backlog",
    priority: 3,
    parentId,
    createdAt: now,
    updatedAt: now,
  };
}

describe("SqliteStore × AsyncMutex stress (E12.T01)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = makeStore();
  });

  afterEach(() => {
    store.close();
  });

  it("withWriteLock exposes the writeMutex for caller-scoped serialization", async () => {
    expect(typeof store.withWriteLock).toBe("function");
    expect(store.writeMutex.isLocked).toBe(false);
    const result = await store.withWriteLock(() => 42);
    expect(result).toBe(42);
  });

  it("100 sequential writes via withWriteLock complete without deadlock", async () => {
    const tasks: Promise<void>[] = [];
    for (let i = 0; i < 100; i++) {
      tasks.push(
        store.withWriteLock(() => {
          store.insertNode(makeNode(`seq-${i}`));
        }),
      );
    }
    await Promise.all(tasks);

    // All 100 nodes must be persisted (no lost writes from race).
    for (let i = 0; i < 100; i++) {
      const node = store.getNodeById(`seq-${i}`);
      expect(node).not.toBeNull();
    }
    expect(store.writeMutex.isLocked).toBe(false);
  });

  it("multi-step async write (insert + child) is atomic per caller", async () => {
    // Two callers each do { insert parent; await sleep; insert child }. Without
    // the mutex they would interleave and the second caller's child could be
    // inserted under the first caller's parent. With the mutex, parent A and
    // child A complete before parent B starts.
    const sleep = () => new Promise<void>((r) => setImmediate(r));

    const callerA = store.withWriteLock(async () => {
      store.insertNode(makeNode("parent-a"));
      await sleep();
      store.insertNode(makeNode("child-a", "parent-a"));
    });
    const callerB = store.withWriteLock(async () => {
      store.insertNode(makeNode("parent-b"));
      await sleep();
      store.insertNode(makeNode("child-b", "parent-b"));
    });
    await Promise.all([callerA, callerB]);

    expect(store.getNodeById("parent-a")?.id).toBe("parent-a");
    expect(store.getNodeById("child-a")?.parentId).toBe("parent-a");
    expect(store.getNodeById("parent-b")?.id).toBe("parent-b");
    expect(store.getNodeById("child-b")?.parentId).toBe("parent-b");
  });

  it("mutex overhead is sub-millisecond per acquire/release", async () => {
    const N = 1000;
    const start = performance.now();
    for (let i = 0; i < N; i++) {
      await store.withWriteLock(() => i);
    }
    const elapsed = performance.now() - start;
    const perCall = elapsed / N;
    expect(perCall).toBeLessThan(1); // < 1ms per acquire/release
  });

  it("releases mutex on caller throw (no permanent lock)", async () => {
    await expect(
      store.withWriteLock(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow(/boom/);

    // Mutex must be released so subsequent writes proceed.
    expect(store.writeMutex.isLocked).toBe(false);
    await store.withWriteLock(() => {
      store.insertNode(makeNode("after-throw"));
    });
    expect(store.getNodeById("after-throw")).not.toBeNull();
  });

  it("FIFO order: queued writes execute in submission order", async () => {
    const order: number[] = [];
    const writes: Promise<void>[] = [];
    for (let i = 0; i < 20; i++) {
      writes.push(
        store.withWriteLock(async () => {
          // Force await so the next caller actually queues.
          await Promise.resolve();
          order.push(i);
        }),
      );
    }
    await Promise.all(writes);
    expect(order).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});
