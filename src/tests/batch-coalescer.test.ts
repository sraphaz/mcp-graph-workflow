/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T10 — batch-coalescer tests.
 */

import { describe, it, expect, vi } from "vitest";
import { BatchCoalescer } from "../core/llm/batch-coalescer.js";

describe("BatchCoalescer (E6.T10)", () => {
  it("flushes on max size before timeout fires", async () => {
    const executor = vi.fn(async (items: number[]) => items.map((x) => x * 2));
    const c = new BatchCoalescer<number, number>({
      maxBatchSize: 3,
      windowMs: 1000,
      executor,
    });

    const results = await Promise.all([c.submit(1), c.submit(2), c.submit(3)]);
    expect(results).toEqual([2, 4, 6]);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("flushes on timeout when below max size", async () => {
    const executor = vi.fn(async (items: number[]) => items.map((x) => x + 100));
    const c = new BatchCoalescer<number, number>({
      maxBatchSize: 100,
      windowMs: 30,
      executor,
    });
    const results = await Promise.all([c.submit(1), c.submit(2)]);
    expect(results).toEqual([101, 102]);
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it("demuxes results back to each caller in submission order", async () => {
    const executor = async (items: string[]) =>
      items.map((s) => s.toUpperCase());
    const c = new BatchCoalescer<string, string>({
      maxBatchSize: 4,
      windowMs: 1000,
      executor,
    });
    const [a, b, c2, d] = await Promise.all([
      c.submit("a"),
      c.submit("b"),
      c.submit("c"),
      c.submit("d"),
    ]);
    expect([a, b, c2, d]).toEqual(["A", "B", "C", "D"]);
  });

  it("propagates executor errors to all submitted callers in the batch", async () => {
    const boom = new Error("boom");
    const executor = async (_items: number[]): Promise<number[]> => {
      throw boom;
    };
    const c = new BatchCoalescer<number, number>({
      maxBatchSize: 2,
      windowMs: 1000,
      executor,
    });
    const r1 = c.submit(1);
    const r2 = c.submit(2);
    await expect(r1).rejects.toBe(boom);
    await expect(r2).rejects.toBe(boom);
  });

  it("rejects with Error if executor returns wrong-length array", async () => {
    const c = new BatchCoalescer<number, number>({
      maxBatchSize: 2,
      windowMs: 1000,
      executor: async () => [1], // returns 1 result for 2 inputs
    });
    await expect(Promise.all([c.submit(1), c.submit(2)])).rejects.toThrow(
      /length mismatch/i,
    );
  });

  it("starts a new window after a flush", async () => {
    const executor = vi.fn(async (items: number[]) => items.map((x) => x + 1));
    const c = new BatchCoalescer<number, number>({
      maxBatchSize: 2,
      windowMs: 1000,
      executor,
    });

    const r1 = await Promise.all([c.submit(1), c.submit(2)]);
    expect(r1).toEqual([2, 3]);
    const r2 = await Promise.all([c.submit(10), c.submit(20)]);
    expect(r2).toEqual([11, 21]);
    expect(executor).toHaveBeenCalledTimes(2);
  });
});
