/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C1 — AgentPool tests.
 */

import { describe, it, expect } from "vitest";
import {
  AgentPool,
  DEFAULT_POOL_SIZE,
  DEFAULT_ACQUIRE_TIMEOUT_MS,
} from "../core/agents/agent-pool.js";

describe("AgentPool (E22.C1)", () => {
  it("DEFAULT_POOL_SIZE = 4", () => {
    expect(DEFAULT_POOL_SIZE).toBe(4);
  });

  it("DEFAULT_ACQUIRE_TIMEOUT_MS = 5 minutes", () => {
    expect(DEFAULT_ACQUIRE_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });

  it("pre-spawns N agents on construction", () => {
    const pool = new AgentPool({ size: 3 });
    expect(pool.stats()).toEqual({ size: 3, available: 3, inUse: 0, queued: 0 });
  });

  it("acquire returns lease with agentId + release", async () => {
    const pool = new AgentPool({ size: 2 });
    const lease = await pool.acquire();
    expect(lease.agentId).toMatch(/^agent-/);
    expect(typeof lease.release).toBe("function");
    expect(pool.stats().inUse).toBe(1);
    lease.release();
    expect(pool.stats().inUse).toBe(0);
    expect(pool.stats().available).toBe(2);
  });

  it("queues acquire when pool exhausted; release dispatches in FIFO order", async () => {
    const pool = new AgentPool({ size: 2 });
    const l1 = await pool.acquire();
    const l2 = await pool.acquire();
    expect(pool.stats().available).toBe(0);

    const order: number[] = [];
    const p3 = pool.acquire().then((l) => {
      order.push(3);
      l.release();
    });
    const p4 = pool.acquire().then((l) => {
      order.push(4);
      l.release();
    });

    expect(pool.stats().queued).toBe(2);

    l1.release();
    l2.release();

    await Promise.all([p3, p4]);
    expect(order).toEqual([3, 4]);
  });

  it("acquire times out when pool stays exhausted", async () => {
    const pool = new AgentPool({ size: 1 });
    const held = await pool.acquire();
    await expect(pool.acquire(50)).rejects.toThrow(/acquire-timeout/);
    held.release();
  });

  it("5 acquires concurrent on size=3 → 2 wait, complete sequentially", async () => {
    const pool = new AgentPool({ size: 3 });
    const completed: string[] = [];

    const work = (label: string) => async () => {
      const lease = await pool.acquire();
      completed.push(`${label}:${lease.agentId}`);
      await new Promise((r) => setTimeout(r, 5));
      lease.release();
    };

    await Promise.all([
      work("a")(),
      work("b")(),
      work("c")(),
      work("d")(),
      work("e")(),
    ]);

    expect(completed).toHaveLength(5);
    expect(pool.stats().inUse).toBe(0);
    expect(pool.stats().available).toBe(3);
  });

  it("release is idempotent (calling twice does not double-return)", async () => {
    const pool = new AgentPool({ size: 1 });
    const lease = await pool.acquire();
    lease.release();
    lease.release();
    expect(pool.stats().available).toBe(1);
    expect(pool.stats().inUse).toBe(0);
  });

  it("replaceUnhealthy substitutes idle agents that fail isHealthy", () => {
    const dead = new Set<string>();
    const pool = new AgentPool({
      size: 3,
      isHealthy: (id) => !dead.has(id),
    });
    const initial = pool.stats().available;
    expect(initial).toBe(3);
    dead.add("agent-0");
    dead.add("agent-1");
    const replaced = pool.replaceUnhealthy();
    expect(replaced).toBe(2);
    expect(pool.stats().available).toBe(3);
  });

  it("custom spawn function is used to create agent IDs", async () => {
    let i = 0;
    const pool = new AgentPool({ size: 2, spawn: () => `worker-${++i}` });
    const lease = await pool.acquire();
    expect(lease.agentId).toBe("worker-1");
  });

  it("drain rejects pending waiters", async () => {
    const pool = new AgentPool({ size: 1 });
    await pool.acquire();
    const waiting = pool.acquire(60_000);
    pool.drain();
    await expect(waiting).rejects.toThrow(/drained/);
  });
});
