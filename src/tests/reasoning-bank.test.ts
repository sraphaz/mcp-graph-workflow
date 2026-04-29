/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-5.T04 — reasoning-bank tests.
 */

import { describe, it, expect } from "vitest";
import {
  storeTrajectory,
  recallSimilar,
  recallSuccessful,
  toolSequenceSimilarity,
  createMemoryTrajectoryStore,
  TrajectorySchema,
  type Trajectory,
} from "../core/learning/reasoning-bank.js";

function tr(
  id: string,
  toolSequence: string[],
  outcomeScore: number,
  ts = 0,
): Trajectory {
  return { id, nodeId: `n-${id}`, toolSequence, outcomeScore, ts };
}

describe("reasoning-bank (E5.T04)", () => {
  describe("TrajectorySchema", () => {
    it("accepts valid payload", () => {
      const valid = tr("1", ["start_task", "finish_task"], 1);
      expect(TrajectorySchema.safeParse(valid).success).toBe(true);
    });

    it("rejects empty toolSequence", () => {
      expect(
        TrajectorySchema.safeParse({ ...tr("1", [], 1) }).success,
      ).toBe(false);
    });

    it("rejects outcomeScore outside [0,1]", () => {
      expect(TrajectorySchema.safeParse(tr("1", ["x"], 1.2)).success).toBe(false);
      expect(TrajectorySchema.safeParse(tr("1", ["x"], -0.1)).success).toBe(false);
    });
  });

  describe("storeTrajectory", () => {
    it("validates + appends to store", () => {
      const store = createMemoryTrajectoryStore();
      const t = storeTrajectory(store, tr("a", ["x", "y"], 0.8));
      expect(t.id).toBe("a");
      expect(store.count()).toBe(1);
    });

    it("throws on invalid payload (caller never half-writes)", () => {
      const store = createMemoryTrajectoryStore();
      expect(() => storeTrajectory(store, { id: "x" })).toThrow(/invalid-trajectory/);
      expect(store.count()).toBe(0);
    });
  });

  describe("toolSequenceSimilarity", () => {
    it("identical sequences → 1", () => {
      expect(toolSequenceSimilarity(["a", "b"], ["a", "b"])).toBe(1);
    });

    it("disjoint sequences → 0", () => {
      expect(toolSequenceSimilarity(["a"], ["b"])).toBe(0);
    });

    it("partial overlap returns Jaccard", () => {
      // {a,b} ∩ {a,c} = {a}; |union| = 3; sim = 1/3
      expect(toolSequenceSimilarity(["a", "b"], ["a", "c"])).toBeCloseTo(1 / 3);
    });

    it("empty sequences both → 1 (degenerate)", () => {
      expect(toolSequenceSimilarity([], [])).toBe(1);
    });
  });

  describe("recallSimilar", () => {
    it("returns top-k matches sorted by similarity DESC", () => {
      const store = createMemoryTrajectoryStore([
        tr("a", ["start", "finish"], 0.9),
        tr("b", ["start", "next", "finish"], 0.5),
        tr("c", ["completely", "different"], 0.7),
      ]);
      const matches = recallSimilar(store, ["start", "finish"], 2);
      expect(matches).toHaveLength(2);
      expect(matches[0].trajectory.id).toBe("a");
      expect(matches[0].similarity).toBe(1);
    });

    it("ties on similarity break by outcomeScore DESC", () => {
      const store = createMemoryTrajectoryStore([
        tr("low", ["x"], 0.3),
        tr("high", ["x"], 0.95),
      ]);
      const matches = recallSimilar(store, ["x"], 2);
      expect(matches[0].trajectory.id).toBe("high");
      expect(matches[1].trajectory.id).toBe("low");
    });

    it("returns [] on empty store", () => {
      expect(recallSimilar(createMemoryTrajectoryStore(), ["x"], 5)).toEqual([]);
    });

    it("topK=0 returns empty", () => {
      const store = createMemoryTrajectoryStore([tr("a", ["x"], 1)]);
      expect(recallSimilar(store, ["x"], 0)).toEqual([]);
    });
  });

  describe("recallSuccessful", () => {
    it("filters by minScore", () => {
      const store = createMemoryTrajectoryStore([
        tr("good", ["x"], 0.95),
        tr("ok", ["x"], 0.6),
        tr("bad", ["x"], 0.3),
      ]);
      const r = recallSuccessful(store, ["x"], 0.7, 5);
      expect(r.map((m) => m.trajectory.id)).toEqual(["good"]);
    });

    it("respects topK after filtering", () => {
      const store = createMemoryTrajectoryStore([
        tr("a", ["x"], 0.9),
        tr("b", ["x"], 0.85),
        tr("c", ["x"], 0.8),
      ]);
      const r = recallSuccessful(store, ["x"], 0.7, 2);
      expect(r).toHaveLength(2);
    });
  });
});
