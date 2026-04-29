/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { Semaphore, QueueTimeoutError } from "../core/utils/semaphore.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Semaphore", () => {
  it("permits up to N concurrent acquisitions", async () => {
    const sem = new Semaphore({ max: 2 });
    let live = 0;
    let peak = 0;

    const work = async () => {
      const release = await sem.acquire();
      live++;
      peak = Math.max(peak, live);
      await delay(20);
      live--;
      release();
    };

    await Promise.all([work(), work(), work(), work(), work()]);
    expect(peak).toBe(2);
  });

  it("queues additional requests until a slot frees", async () => {
    const sem = new Semaphore({ max: 1 });
    const order: string[] = [];

    const r1 = await sem.acquire();
    const p2 = (async () => {
      const r = await sem.acquire();
      order.push("second");
      r();
    })();
    await delay(10);
    order.push("first-releases");
    r1();
    await p2;

    expect(order).toEqual(["first-releases", "second"]);
  });

  it("rejects with QueueTimeoutError when wait exceeds timeoutMs", async () => {
    const sem = new Semaphore({ max: 1 });
    const r1 = await sem.acquire();
    await expect(sem.acquire(20)).rejects.toBeInstanceOf(QueueTimeoutError);
    r1();
  });

  it("default timeout from constructor option is honored", async () => {
    const sem = new Semaphore({ max: 1, defaultTimeoutMs: 15 });
    const r1 = await sem.acquire();
    await expect(sem.acquire()).rejects.toBeInstanceOf(QueueTimeoutError);
    r1();
  });

  it("releasing twice is a no-op (idempotent)", async () => {
    const sem = new Semaphore({ max: 1 });
    const release = await sem.acquire();
    release();
    release(); // must not throw or double-decrement
    const r2 = await sem.acquire(50);
    r2();
  });

  it("wrap() runs fn under the semaphore and releases on error", async () => {
    const sem = new Semaphore({ max: 1 });
    let live = 0;
    let peak = 0;
    const job = async () => {
      live++;
      peak = Math.max(peak, live);
      await delay(10);
      live--;
      throw new Error("boom");
    };

    await expect(sem.wrap(job)).rejects.toThrow("boom");
    // After failure, slot must be free and a new acquisition succeeds quickly.
    const r = await sem.acquire(50);
    r();
    expect(peak).toBe(1);
  });

  it("getStats() reports active and queued counts", async () => {
    const sem = new Semaphore({ max: 1 });
    const r1 = await sem.acquire();
    const pending = sem.acquire(); // queued
    const stats = sem.getStats();
    expect(stats.active).toBe(1);
    expect(stats.queued).toBe(1);
    expect(stats.max).toBe(1);
    r1();
    (await pending)();
  });
});
