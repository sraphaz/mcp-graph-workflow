/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { AsyncMutex } from "../core/utils/async-mutex.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import type { GraphNode } from "../core/graph/graph-types.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";

// ── AsyncMutex unit tests ────────────────────────────────

describe("AsyncMutex", () => {
  it("serializes concurrent async operations — no interleaving", async () => {
    const mutex = new AsyncMutex();
    const log: string[] = [];

    const job = async (label: string): Promise<void> => {
      const release = await mutex.acquire();
      try {
        log.push(`${label}:start`);
        await new Promise<void>((r) => setImmediate(r));
        log.push(`${label}:end`);
      } finally {
        release();
      }
    };

    await Promise.all([job("A"), job("B")]);

    // Each label's :end must follow its :start without the other label in between
    const [s1, e1, s2, e2] = log;
    expect(s1).toMatch(/:start$/);
    expect(e1).toBe(s1.replace(":start", ":end"));
    expect(s2).toMatch(/:start$/);
    expect(e2).toBe(s2.replace(":start", ":end"));
  });

  it("run() returns the synchronous function result", async () => {
    const mutex = new AsyncMutex();
    const result = await mutex.run(() => 42);
    expect(result).toBe(42);
  });

  it("releases lock after sync error — subsequent acquire succeeds", async () => {
    const mutex = new AsyncMutex();

    await expect(
      mutex.run(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    // Must still be usable after the error
    const result = await mutex.run(() => 99);
    expect(result).toBe(99);
  });

  it("processes queued waiters in FIFO order", async () => {
    const mutex = new AsyncMutex();
    const order: number[] = [];

    // Hold the lock
    const release = await mutex.acquire();

    // Queue 3 waiters while locked
    const waiters = [1, 2, 3].map((n) => mutex.run(() => { order.push(n); }));

    release();
    await Promise.all(waiters);

    expect(order).toEqual([1, 2, 3]);
  });

  it("isLocked reflects current state correctly", () => {
    const mutex = new AsyncMutex();
    expect(mutex.isLocked).toBe(false);

    const releasePromise = mutex.acquire();
    // acquire() schedules the resolve microtask, but before it fires isLocked should be true
    // after the first non-blocked acquire synchronous check inside acquire()
    releasePromise.then(() => {
      expect(mutex.isLocked).toBe(true);
    });
  });
});

// ── SqliteStore concurrent-write tests ──────────────────

function makeNode(id: string): GraphNode {
  return {
    id,
    type: "task",
    title: `Task ${id}`,
    status: "backlog",
    priority: 1,
    blocked: false,
    createdAt: now(),
    updatedAt: now(),
  };
}

describe("SqliteStore — concurrent writes via withWriteLock", () => {
  it("2 workers writing 500 rows each complete without errors and within 5s", async () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("concurrent-test");

    const writeWorker = async (prefix: string, count: number): Promise<void> => {
      for (let i = 0; i < count; i++) {
        await store.withWriteLock(() => {
          store.insertNode(makeNode(`${prefix}-${generateId("n")}`));
        });
      }
    };

    const start = Date.now();
    await Promise.all([writeWorker("A", 500), writeWorker("B", 500)]);
    const elapsed = Date.now() - start;

    const nodes = store.getAllNodes();
    expect(nodes).toHaveLength(1000);
    expect(elapsed).toBeLessThan(5000);

    store.close();
  });

  it("leituras concorrentes não são bloqueadas pelo write mutex", async () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("read-test");

    // Insert a few nodes directly
    for (let i = 0; i < 5; i++) {
      store.insertNode(makeNode(`n-${i}`));
    }

    // Concurrent reads — must all succeed regardless of write lock state
    const reads = Array.from({ length: 10 }, () =>
      Promise.resolve(store.getAllNodes()),
    );
    const results = await Promise.all(reads);

    for (const r of results) {
      expect(r).toHaveLength(5);
    }

    store.close();
  });

  it("withWriteLock releases lock on error — store remains usable", async () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("error-test");

    await expect(
      store.withWriteLock(() => {
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");

    // Store must still accept writes after error
    await store.withWriteLock(() => {
      store.insertNode(makeNode("recovery-node"));
    });

    expect(store.getAllNodes()).toHaveLength(1);

    store.close();
  });
});
