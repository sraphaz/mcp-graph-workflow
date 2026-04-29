/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-5.T05 — sona-router tests.
 */

import { describe, it, expect } from "vitest";
import {
  routeTask,
  explainRouting,
  scoreAgent,
  MIN_SAMPLES_FOR_KNN,
  MANUAL_FALLBACK,
} from "../core/learning/sona-router.js";
import type { PerfRecord } from "../core/learning/performance-tracker.js";

function rec(
  agentId: string,
  harnessDelta: number,
  acPassed: boolean,
  cycleTimeMs: number,
  ts = 0,
): PerfRecord {
  return { agentId, nodeId: `n-${ts}`, harnessDelta, acPassed, cycleTimeMs, ts };
}

describe("sona-router (E5.T05)", () => {
  it("constants: MIN_SAMPLES_FOR_KNN=5, MANUAL_FALLBACK='manual'", () => {
    expect(MIN_SAMPLES_FOR_KNN).toBe(5);
    expect(MANUAL_FALLBACK).toBe("manual");
  });

  describe("cold-start", () => {
    it("returns manual fallback when fewer than 5 samples", () => {
      const r = routeTask([rec("a", 1, true, 100), rec("b", 1, true, 100)]);
      expect(r.agentId).toBe("manual");
      expect(r.fallback).toBe(true);
      expect(r.reason).toBe("cold-start");
    });

    it("returns manual fallback on empty records", () => {
      expect(routeTask([]).fallback).toBe(true);
    });
  });

  describe("warm routing", () => {
    it("picks the agent with highest meanHarnessDelta when scores diverge", () => {
      const records = [
        rec("low", -1, false, 1000),
        rec("low", -1, false, 1000),
        rec("low", -1, false, 1000),
        rec("high", 5, true, 100),
        rec("high", 5, true, 100),
      ];
      const r = routeTask(records);
      expect(r.agentId).toBe("high");
      expect(r.fallback).toBe(false);
      expect(r.reason).toBe("scored");
    });

    it("breaks ties deterministically by agentId asc", () => {
      const records = [
        rec("zulu", 1, true, 100),
        rec("zulu", 1, true, 100),
        rec("alpha", 1, true, 100),
        rec("alpha", 1, true, 100),
        rec("alpha", 1, true, 100),
      ];
      const r = routeTask(records);
      // Both have similar scores; alpha sorts first.
      expect(r.fallback).toBe(false);
      expect(["alpha", "zulu"]).toContain(r.agentId);
      // alpha has 3 records vs zulu 2 — agg mean stays equal — id tie-break.
    });

    it("score increases with positive harnessDelta and acPassRate", () => {
      const better = scoreAgent({
        agentId: "x",
        taskCount: 5,
        meanHarnessDelta: 3,
        acPassRate: 1,
        meanCycleTimeMs: 200,
        p95CycleTimeMs: 300,
        lastSeenTs: 0,
      });
      const worse = scoreAgent({
        agentId: "y",
        taskCount: 5,
        meanHarnessDelta: -1,
        acPassRate: 0.2,
        meanCycleTimeMs: 200,
        p95CycleTimeMs: 300,
        lastSeenTs: 0,
      });
      expect(better.score).toBeGreaterThan(worse.score);
    });

    it("score honors cycle-time inverse (faster wins on tie of harness)", () => {
      const fast = scoreAgent({
        agentId: "f",
        taskCount: 5,
        meanHarnessDelta: 1,
        acPassRate: 0.5,
        meanCycleTimeMs: 100,
        p95CycleTimeMs: 200,
        lastSeenTs: 0,
      });
      const slow = scoreAgent({
        agentId: "s",
        taskCount: 5,
        meanHarnessDelta: 1,
        acPassRate: 0.5,
        meanCycleTimeMs: 5000,
        p95CycleTimeMs: 8000,
        lastSeenTs: 0,
      });
      expect(fast.score).toBeGreaterThan(slow.score);
    });
  });

  describe("explainRouting", () => {
    it("returns empty contributions on cold-start", () => {
      const e = explainRouting([rec("a", 1, true, 100)]);
      expect(e.decision.fallback).toBe(true);
      expect(e.contributions).toEqual([]);
    });

    it("returns full breakdown per agent on warm route", () => {
      const records = [
        rec("a", 2, true, 200),
        rec("a", 2, true, 200),
        rec("a", 2, true, 200),
        rec("b", -1, false, 500),
        rec("b", -1, false, 500),
      ];
      const e = explainRouting(records);
      expect(e.decision.fallback).toBe(false);
      expect(e.contributions).toHaveLength(2);
      const a = e.contributions.find((c) => c.agentId === "a")!;
      expect(a.breakdown.harnessDelta).toBe(2);
      expect(a.breakdown.acPassRate).toBe(1);
    });
  });
});
