/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { TensorBufferPool } from "../core/rag/tensor-buffer-pool.js";

describe("TensorBufferPool", () => {
  it("pre-allocates the correct number of slots on construction", () => {
    const pool = new TensorBufferPool(4);
    expect(pool.size).toBe(4);
    expect(pool.available).toBe(4);
  });

  it("acquire() returns a slot with correctly-sized BigInt64Array and Float32Array buffers", async () => {
    const pool = new TensorBufferPool(2);
    const { slot, release } = await pool.acquire();

    expect(slot.inputIds).toBeInstanceOf(BigInt64Array);
    expect(slot.inputIds.length).toBe(128);
    expect(slot.attentionMask).toBeInstanceOf(BigInt64Array);
    expect(slot.attentionMask.length).toBe(128);
    expect(slot.tokenTypeIds).toBeInstanceOf(BigInt64Array);
    expect(slot.tokenTypeIds.length).toBe(128);

    release();
    expect(pool.available).toBe(2);
  });

  it("decrements available count while slot is held", async () => {
    const pool = new TensorBufferPool(4);

    const h1 = await pool.acquire();
    expect(pool.available).toBe(3);

    const h2 = await pool.acquire();
    expect(pool.available).toBe(2);

    h1.release();
    expect(pool.available).toBe(3);

    h2.release();
    expect(pool.available).toBe(4);
  });

  it("5th acquire() waits when all 4 slots are busy", async () => {
    const pool = new TensorBufferPool(4);

    const handles = await Promise.all([
      pool.acquire(),
      pool.acquire(),
      pool.acquire(),
      pool.acquire(),
    ]);
    expect(pool.available).toBe(0);

    let resolved = false;
    const waiter = pool.acquire().then((handle) => {
      resolved = true;
      handle.release();
    });

    // Still not resolved — pool exhausted
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Release one — waiter should get it
    handles[0].release();
    await waiter;
    expect(resolved).toBe(true);

    handles[1].release();
    handles[2].release();
    handles[3].release();
    expect(pool.available).toBe(4);
  });

  it("returns the SAME underlying buffer objects on reuse (zero-alloc)", async () => {
    const pool = new TensorBufferPool(1);

    const h1 = await pool.acquire();
    const ref = h1.slot.inputIds;
    h1.release();

    const h2 = await pool.acquire();
    // Same buffer object reused — no new allocation
    expect(h2.slot.inputIds).toBe(ref);
    h2.release();
  });

  it("data written to slot is readable after fill", async () => {
    const pool = new TensorBufferPool(1);
    const { slot, release } = await pool.acquire();

    slot.inputIds[0] = 101n; // CLS token
    slot.inputIds[127] = 102n; // SEP token
    slot.attentionMask.fill(1n);

    expect(slot.inputIds[0]).toBe(101n);
    expect(slot.inputIds[127]).toBe(102n);
    expect(slot.attentionMask[63]).toBe(1n);

    release();
  });

  it("processes 1000 sequential acquires without memory leak (< 10MB delta)", async () => {
    const pool = new TensorBufferPool(4);
    const baselineHeap = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      const { slot, release } = await pool.acquire();
      // Simulate filling buffers (as done in generateEmbedding)
      slot.inputIds.fill(BigInt(i % 100));
      slot.attentionMask.fill(1n);
      slot.tokenTypeIds.fill(0n);
      release();
    }

    // Force GC if available
    if (global.gc) global.gc();

    const heapDelta = process.memoryUsage().heapUsed - baselineHeap;
    // 10MB tolerance — pool reuses buffers so no linear growth expected
    expect(heapDelta).toBeLessThan(10 * 1024 * 1024);
  });
});
