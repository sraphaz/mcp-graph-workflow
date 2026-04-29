/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { assembleContext, CONTEXT_CHUNK_SIZE, invalidateAssemblerCache } from "../core/context/context-assembler.js";

afterEach(() => {
  vi.restoreAllMocks();
  invalidateAssemblerCache();
});

function makeStore(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("test-project");
  return store;
}

function addNodes(store: SqliteStore, count: number): void {
  for (let i = 0; i < count; i++) {
    store.insertNode({
      id: `node-${i}`,
      type: "task",
      title: i % 10 === 0 ? `matching-topic-node-${i}` : `unrelated-node-${i}`,
      status: "backlog",
      priority: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

describe("CONTEXT_CHUNK_SIZE constant", () => {
  it("defaults to 100 or uses CONTEXT_CHUNK_SIZE env var", () => {
    const envVal = process.env["CONTEXT_CHUNK_SIZE"];
    if (envVal) {
      expect(CONTEXT_CHUNK_SIZE).toBe(parseInt(envVal, 10));
    } else {
      expect(CONTEXT_CHUNK_SIZE).toBe(100);
    }
  });
});

describe("assembleContext — chunked node loading", () => {
  it("does not call getAllNodes() when assembling context", () => {
    const store = makeStore();
    addNodes(store, 50);
    const spy = vi.spyOn(store, "getAllNodes");

    assembleContext(store, "matching-topic");

    // getAllNodes must not be called — chunked path uses queryNodes or searchNodes instead
    expect(spy).not.toHaveBeenCalled();
  });

  it("uses queryNodes (paginated) for fallback node search", () => {
    const store = makeStore();
    addNodes(store, 200);
    const spy = vi.spyOn(store, "queryNodes");

    // Disable FTS to force the fallback path
    vi.spyOn(store, "searchNodes").mockImplementation(() => {
      throw new Error("FTS disabled");
    });

    assembleContext(store, "matching-topic");

    // queryNodes must be called with a limit (not loading all at once)
    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls[0][0];
    expect(call.limit).toBeLessThanOrEqual(CONTEXT_CHUNK_SIZE);
  });

  it("still returns relevant results with 200 nodes", () => {
    const store = makeStore();
    addNodes(store, 200);

    const result = assembleContext(store, "matching-topic");

    // Should have found at least one relevant section (20 nodes have 'matching-topic' in title)
    const hasRelevant = result.sections.some((s) => s.name.toLowerCase().includes("matching"));
    expect(hasRelevant).toBe(true);
  });

  it("does not exceed heap by 50MB when processing 300 nodes", () => {
    const store = makeStore();
    addNodes(store, 300);

    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;

    for (let i = 0; i < 5; i++) {
      assembleContext(store, "matching-topic");
    }

    if (global.gc) global.gc();
    const delta = process.memoryUsage().heapUsed - before;
    // 50MB tolerance — chunked loading avoids loading all 300 nodes × 5 runs
    expect(delta).toBeLessThan(50 * 1024 * 1024);
  });
});
