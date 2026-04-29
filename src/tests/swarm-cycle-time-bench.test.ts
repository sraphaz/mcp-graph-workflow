/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 19 — Multi-Agent Topologies (E19.T07).
 * Tests for cycle-time bench: single-agent (sequential) vs hierarchical
 * (queen dispatches to N workers in parallel).
 */

import { describe, it, expect } from "vitest";
import { runCycleTimeBench } from "../core/swarm/cycle-time-bench.js";

describe("cycle-time bench (E19.T07)", () => {
  it("hierarchical (parallel) is faster than single (sequential) for slow tasks", async () => {
    const taskFn = async () => {
      await new Promise((r) => setTimeout(r, 30));
      return 1;
    };
    const result = await runCycleTimeBench({
      taskCount: 6,
      workers: 3,
      taskFn,
    });

    expect(result.single.totalMs).toBeGreaterThan(result.hierarchical.totalMs);
    expect(result.deltaPercent).toBeGreaterThan(0);
    expect(result.single.taskCount).toBe(6);
    expect(result.hierarchical.taskCount).toBe(6);
  });

  it("deltaPercent = (single - hierarchical) / single * 100", async () => {
    const taskFn = async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 1;
    };
    const result = await runCycleTimeBench({ taskCount: 4, workers: 2, taskFn });
    const expected = ((result.single.totalMs - result.hierarchical.totalMs) / result.single.totalMs) * 100;
    expect(result.deltaPercent).toBeCloseTo(expected, 5);
  });

  it("empty task list returns deltaPercent=0 with totalMs=0", async () => {
    const result = await runCycleTimeBench({
      taskCount: 0,
      workers: 3,
      taskFn: async () => 1,
    });
    expect(result.single.totalMs).toBe(0);
    expect(result.hierarchical.totalMs).toBe(0);
    expect(result.deltaPercent).toBe(0);
  });

  it("workers=1 in hierarchical falls back to sequential (deltaPercent ~ 0)", async () => {
    const taskFn = async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 1;
    };
    const result = await runCycleTimeBench({ taskCount: 4, workers: 1, taskFn });
    // With workers=1, hierarchical and single should be roughly equal.
    expect(Math.abs(result.deltaPercent)).toBeLessThan(50);
  });

  it("invalid workers (<1) throws", async () => {
    await expect(
      runCycleTimeBench({ taskCount: 4, workers: 0, taskFn: async () => 1 }),
    ).rejects.toThrow();
  });

  it("ranOk=true when all tasks resolved without errors", async () => {
    const result = await runCycleTimeBench({
      taskCount: 3,
      workers: 2,
      taskFn: async () => 1,
    });
    expect(result.ranOk).toBe(true);
  });
});
