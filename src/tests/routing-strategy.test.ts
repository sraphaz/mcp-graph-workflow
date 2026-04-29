/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-5.T06 — routing strategy tests.
 */

import { describe, it, expect } from "vitest";
import {
  decideRoute,
  isValidStrategy,
  ROUTING_STRATEGIES,
  HYBRID_CONFIDENT_SCORE,
} from "../core/learning/routing-strategy.js";
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

const STRONG_HISTORY: PerfRecord[] = Array.from({ length: 10 }, (_, i) =>
  rec("alpha", 5, true, 100, i),
);

describe("routing-strategy (E5.T06)", () => {
  it("ROUTING_STRATEGIES includes manual, sona, hybrid", () => {
    expect(ROUTING_STRATEGIES).toContain("manual");
    expect(ROUTING_STRATEGIES).toContain("sona");
    expect(ROUTING_STRATEGIES).toContain("hybrid");
  });

  it("isValidStrategy accepts the three names and rejects others", () => {
    expect(isValidStrategy("manual")).toBe(true);
    expect(isValidStrategy("sona")).toBe(true);
    expect(isValidStrategy("hybrid")).toBe(true);
    expect(isValidStrategy("auto")).toBe(false);
    expect(isValidStrategy(undefined)).toBe(false);
  });

  describe("manual", () => {
    it("default (no strategy) returns manual fallback", () => {
      const d = decideRoute({ records: STRONG_HISTORY });
      expect(d.strategy).toBe("manual");
      expect(d.agentId).toBe("manual");
      expect(d.fallback).toBe(true);
    });

    it("explicit manual ignores rich records", () => {
      const d = decideRoute({ strategy: "manual", records: STRONG_HISTORY });
      expect(d.agentId).toBe("manual");
    });
  });

  describe("sona", () => {
    it("warm: returns sona pick", () => {
      const d = decideRoute({ strategy: "sona", records: STRONG_HISTORY });
      expect(d.strategy).toBe("sona");
      expect(d.agentId).toBe("alpha");
      expect(d.fallback).toBe(false);
    });

    it("cold: falls back to manual", () => {
      const d = decideRoute({
        strategy: "sona",
        records: [rec("a", 1, true, 100)],
      });
      expect(d.strategy).toBe("sona");
      expect(d.fallback).toBe(true);
      expect(d.agentId).toBe("manual");
    });
  });

  describe("hybrid", () => {
    it("uses sona when confident (score >= threshold)", () => {
      const d = decideRoute({ strategy: "hybrid", records: STRONG_HISTORY });
      expect(d.strategy).toBe("hybrid");
      expect(d.agentId).toBe("alpha");
      expect(d.notes).toMatch(/sona-confident/);
    });

    it("falls back to manual on cold-start", () => {
      const d = decideRoute({ strategy: "hybrid", records: [] });
      expect(d.strategy).toBe("hybrid");
      expect(d.agentId).toBe("manual");
      expect(d.notes).toMatch(/cold-fallback/);
    });

    it("falls back to manual when sona pick has low confidence", () => {
      // Score weights: 0.5*delta + 0.3*ac + 0.2*cycleInverse
      // Make all components low: delta 0.1, ac 0.5, cycle 5000ms (cycleInverse=0.2)
      // Score ≈ 0.5*0.1 + 0.3*0.5 + 0.2*0.2 = 0.05 + 0.15 + 0.04 = 0.24 < 1.0
      const weak: PerfRecord[] = Array.from({ length: 6 }, (_, i) =>
        rec("weak", 0.1, i < 3, 5000, i),
      );
      const d = decideRoute({ strategy: "hybrid", records: weak });
      expect(d.strategy).toBe("hybrid");
      expect(d.agentId).toBe("manual");
      expect(d.notes).toMatch(/low-confidence/);
    });
  });

  it("HYBRID_CONFIDENT_SCORE = 1.0", () => {
    expect(HYBRID_CONFIDENT_SCORE).toBe(1.0);
  });
});
