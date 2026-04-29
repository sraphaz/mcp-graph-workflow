/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ConcurrentSemaphore,
  MAX_CONCURRENT_HEAVY,
  QUEUE_TIMEOUT_MS,
} from "../core/utils/concurrent-semaphore.js";

afterEach(() => vi.restoreAllMocks());

describe("ConcurrentSemaphore — basic acquisition", () => {
  it("resolves immediately when slots are available", async () => {
    const sem = new ConcurrentSemaphore(2);
    const release = await sem.acquire("context");
    expect(sem.active).toBe(1);
    expect(sem.queued).toBe(0);
    release();
    expect(sem.active).toBe(0);
  });

  it("allows up to maxConcurrent simultaneous acquisitions", async () => {
    const sem = new ConcurrentSemaphore(2);
    const r1 = await sem.acquire("context");
    const r2 = await sem.acquire("analyze");
    expect(sem.active).toBe(2);
    r1();
    r2();
    expect(sem.active).toBe(0);
  });

  it("queues a 3rd acquisition when 2 are active", async () => {
    const sem = new ConcurrentSemaphore(2, 30_000);
    const r1 = await sem.acquire("context");
    const r2 = await sem.acquire("analyze");

    let resolved = false;
    const waiter = sem.acquire("search").then((release) => {
      resolved = true;
      release();
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(sem.queued).toBe(1);

    r1();
    await waiter;
    expect(resolved).toBe(true);
    r2();
  });

  it("returns to 0 after all releases", async () => {
    const sem = new ConcurrentSemaphore(2);
    const r1 = await sem.acquire("context");
    const r2 = await sem.acquire("analyze");
    r1();
    r2();
    expect(sem.active).toBe(0);
    expect(sem.queued).toBe(0);
  });
});

describe("ConcurrentSemaphore — timeout", () => {
  it("rejects with QUEUE_TIMEOUT after waiting too long", async () => {
    vi.useFakeTimers();
    const sem = new ConcurrentSemaphore(1, 100);
    const r1 = await sem.acquire("context");

    const waiter = sem.acquire("analyze");
    vi.advanceTimersByTime(101);

    await expect(waiter).rejects.toThrow("QUEUE_TIMEOUT");
    r1();
    vi.useRealTimers();
  });

  it("resolves before timeout fires when slot is released in time", async () => {
    vi.useFakeTimers();
    const sem = new ConcurrentSemaphore(1, 500);
    const r1 = await sem.acquire("context");

    let resolved = false;
    const waiter = sem.acquire("analyze").then((rel) => {
      resolved = true;
      rel();
    });

    vi.advanceTimersByTime(200);
    r1();
    await waiter;
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});

describe("ConcurrentSemaphore — checkForTool()", () => {
  it("returns null for heavy tool when slots are available", () => {
    const sem = new ConcurrentSemaphore(2);
    expect(sem.checkForTool("context")).toBeNull();
  });

  it("returns null for light tool regardless of load", async () => {
    const sem = new ConcurrentSemaphore(1);
    const r1 = await sem.acquire("context");
    expect(sem.checkForTool("node")).toBeNull();
    expect(sem.checkForTool("list")).toBeNull();
    expect(sem.checkForTool("show")).toBeNull();
    r1();
  });

  it("returns CONCURRENCY_LIMIT error for heavy tool when queue is full", async () => {
    const sem = new ConcurrentSemaphore(1, 30_000, 0);
    const r1 = await sem.acquire("context");
    const result = sem.checkForTool("analyze");
    expect(result).not.toBeNull();
    expect(result?.isError).toBe(true);
    expect(result?.content[0].text).toContain("CONCURRENCY_LIMIT");
    r1();
  });
});

describe("MAX_CONCURRENT_HEAVY and QUEUE_TIMEOUT_MS constants", () => {
  it("MAX_CONCURRENT_HEAVY defaults to 2 or uses env var", () => {
    const envVal = process.env["MAX_CONCURRENT_HEAVY"];
    if (envVal) {
      expect(MAX_CONCURRENT_HEAVY).toBe(parseInt(envVal, 10));
    } else {
      expect(MAX_CONCURRENT_HEAVY).toBe(2);
    }
  });

  it("QUEUE_TIMEOUT_MS defaults to 30000", () => {
    expect(QUEUE_TIMEOUT_MS).toBe(30_000);
  });
});
