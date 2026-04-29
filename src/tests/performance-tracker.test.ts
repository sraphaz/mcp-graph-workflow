/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-5.T02 — performance-tracker tests.
 */

import { describe, it, expect } from "vitest";
import {
  aggregatePerformance,
  recordsForAgent,
  trimToRecent,
  type PerfRecord,
} from "../core/learning/performance-tracker.js";

function rec(
  agentId: string,
  harnessDelta: number,
  acPassed: boolean,
  cycleTimeMs: number,
  ts = 0,
): PerfRecord {
  return { agentId, nodeId: `n-${ts}`, harnessDelta, acPassed, cycleTimeMs, ts };
}

describe("performance-tracker (E5.T02)", () => {
  it("returns [] on empty records", () => {
    expect(aggregatePerformance([])).toEqual([]);
  });

  it("computes per-agent stats: taskCount, meanHarnessDelta, acPassRate", () => {
    const stats = aggregatePerformance([
      rec("a", +2, true, 1000),
      rec("a", -1, false, 2000),
      rec("a", +3, true, 3000),
      rec("b", +1, true, 500),
    ]);
    const a = stats.find((s) => s.agentId === "a")!;
    expect(a.taskCount).toBe(3);
    expect(a.meanHarnessDelta).toBeCloseTo((2 - 1 + 3) / 3);
    expect(a.acPassRate).toBeCloseTo(2 / 3);
    expect(a.meanCycleTimeMs).toBeCloseTo(2000);
    const b = stats.find((s) => s.agentId === "b")!;
    expect(b.taskCount).toBe(1);
    expect(b.acPassRate).toBe(1);
  });

  it("computes p95CycleTimeMs from sorted durations", () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      rec("a", 0, true, (i + 1) * 10),
    );
    const [s] = aggregatePerformance(records);
    expect(s.p95CycleTimeMs).toBeGreaterThanOrEqual(180);
  });

  it("tracks lastSeenTs as the max record ts per agent", () => {
    const stats = aggregatePerformance([
      rec("a", 0, true, 1, 100),
      rec("a", 0, true, 1, 300),
      rec("a", 0, true, 1, 200),
    ]);
    expect(stats[0].lastSeenTs).toBe(300);
  });

  it("sorts result by meanHarnessDelta DESC (best agents first)", () => {
    const stats = aggregatePerformance([
      rec("low", -2, true, 1),
      rec("low", -3, true, 1),
      rec("high", +5, true, 1),
      rec("high", +4, true, 1),
      rec("mid", +1, true, 1),
    ]);
    expect(stats.map((s) => s.agentId)).toEqual(["high", "mid", "low"]);
  });

  it("recordsForAgent filters; unknown agent → []", () => {
    const records = [rec("a", 1, true, 1), rec("b", 2, false, 2)];
    expect(recordsForAgent(records, "a").map((r) => r.agentId)).toEqual(["a"]);
    expect(recordsForAgent(records, "missing")).toEqual([]);
  });

  it("trimToRecent keeps last N per agent and orders ASC by ts", () => {
    const records: PerfRecord[] = [];
    for (const id of ["a", "b"]) {
      for (let i = 0; i < 15; i++) {
        records.push(rec(id, 0, true, 1, i));
      }
    }
    const trimmed = trimToRecent(records, 5);
    expect(trimmed.filter((r) => r.agentId === "a")).toHaveLength(5);
    expect(trimmed.filter((r) => r.agentId === "b")).toHaveLength(5);
    expect(trimmed.every((r, i, arr) => i === 0 || r.ts >= arr[i - 1].ts)).toBe(true);
  });

  it("single-agent single-record returns sane stats", () => {
    const [s] = aggregatePerformance([rec("solo", +1, true, 50)]);
    expect(s.taskCount).toBe(1);
    expect(s.meanHarnessDelta).toBe(1);
    expect(s.acPassRate).toBe(1);
    expect(s.meanCycleTimeMs).toBe(50);
    expect(s.p95CycleTimeMs).toBe(50);
  });
});
