/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { batchProcess, EMBEDDING_BATCH_SIZE } from "../core/rag/rag-pipeline.js";

afterEach(() => vi.restoreAllMocks());

describe("batchProcess — embedding chunking with event loop yield", () => {
  it("processes all items and returns collected results", async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const results = await batchProcess(items, async (item: number) => item * 2, 3);
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it("yields to the event loop between chunks", async () => {
    const original = global.setImmediate.bind(global);
    let callCount = 0;
    vi.spyOn(global, "setImmediate").mockImplementation((fn) => {
      callCount++;
      return original(fn as (...args: unknown[]) => void);
    });

    const items = Array.from({ length: 150 }, (_, i) => i);
    await batchProcess(items, async (item: number) => item, 50);

    // 150 items / 50 per chunk = 3 chunks → 2 yields (between chunk 1→2 and 2→3)
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it("handles empty input gracefully", async () => {
    const results = await batchProcess([], async (x: number) => x, 50);
    expect(results).toEqual([]);
  });

  it("does not yield when all items fit in a single chunk", async () => {
    const original = global.setImmediate.bind(global);
    let callCount = 0;
    vi.spyOn(global, "setImmediate").mockImplementation((fn) => {
      callCount++;
      return original(fn as (...args: unknown[]) => void);
    });

    await batchProcess([1, 2, 3], async (x: number) => x, 50);
    expect(callCount).toBe(0);
  });

  it("propagates errors from the processor function", async () => {
    await expect(
      batchProcess([1, 2, 3], async (item: number) => {
        if (item === 2) throw new Error("fail at 2");
        return item;
      }, 5),
    ).rejects.toThrow("fail at 2");
  });

  it("EMBEDDING_BATCH_SIZE defaults to 50 or uses EMBEDDING_BATCH_SIZE env var", () => {
    const envVal = process.env["EMBEDDING_BATCH_SIZE"];
    if (envVal) {
      expect(EMBEDDING_BATCH_SIZE).toBe(parseInt(envVal, 10));
    } else {
      expect(EMBEDDING_BATCH_SIZE).toBe(50);
    }
  });
});
