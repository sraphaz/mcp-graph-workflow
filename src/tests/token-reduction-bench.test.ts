/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 17 — Embeddings ONNX + Hybrid Retrieval (E17.T06).
 * Tests for token reduction bench helper (p50/p95 over PRD samples).
 */

import { describe, it, expect } from "vitest";
import {
  computeTokenReductionStats,
  percentile,
  type TokenReductionSample,
} from "../core/rag/token-reduction-bench.js";

describe("token reduction bench (E17.T06)", () => {
  describe("percentile", () => {
    it("p50 of sorted [1,2,3,4,5] = 3", () => {
      expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    });

    it("p95 of [1..100] ≈ 95 (linear interpolation)", () => {
      const arr = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(percentile(arr, 0.95)).toBeCloseTo(95.05, 5);
    });

    it("interpolates linearly between adjacent ranks", () => {
      // [10, 20], q=0.5 → between idx 0 and 1 → 15
      expect(percentile([10, 20], 0.5)).toBe(15);
    });

    it("throws on empty array", () => {
      expect(() => percentile([], 0.5)).toThrow();
    });

    it("clamps q to [0,1]", () => {
      expect(percentile([1, 2, 3], 1.5)).toBe(3);
      expect(percentile([1, 2, 3], -0.5)).toBe(1);
    });

    it("handles unsorted input", () => {
      expect(percentile([5, 1, 3, 4, 2], 0.5)).toBe(3);
    });
  });

  describe("computeTokenReductionStats", () => {
    it("returns zeros for empty samples", () => {
      const r = computeTokenReductionStats([]);
      expect(r.sampleCount).toBe(0);
      expect(r.p50Before).toBe(0);
      expect(r.p95Reduction).toBe(0);
    });

    it("computes percentiles over before/after token counts", () => {
      const samples: TokenReductionSample[] = [
        { before: 1000, after: 500 },
        { before: 2000, after: 600 },
        { before: 3000, after: 1000 },
        { before: 4000, after: 1200 },
      ];
      const r = computeTokenReductionStats(samples);
      expect(r.sampleCount).toBe(4);
      expect(r.p50Before).toBeGreaterThan(0);
      expect(r.p50After).toBeLessThan(r.p50Before);
    });

    it("reduction = (before-after)/before per sample", () => {
      const samples: TokenReductionSample[] = [
        { before: 1000, after: 500 }, // 50%
        { before: 1000, after: 800 }, // 20%
      ];
      const r = computeTokenReductionStats(samples);
      // p50 of [0.2, 0.5] = 0.35
      expect(r.p50Reduction).toBeCloseTo(0.35);
    });

    it("handles before=0 sample without crashing (treated as 0 reduction)", () => {
      const r = computeTokenReductionStats([{ before: 0, after: 0 }]);
      expect(r.p50Reduction).toBe(0);
    });

    it("p95Reduction is at or above p50Reduction", () => {
      const samples: TokenReductionSample[] = Array.from({ length: 50 }, (_, i) => ({
        before: 1000 + i * 10,
        after: 500 + i * 5,
      }));
      const r = computeTokenReductionStats(samples);
      expect(r.p95Reduction).toBeGreaterThanOrEqual(r.p50Reduction);
    });

    it("includes mean reduction for diagnostics", () => {
      const samples: TokenReductionSample[] = [
        { before: 1000, after: 500 },
        { before: 1000, after: 800 },
      ];
      const r = computeTokenReductionStats(samples);
      expect(r.meanReduction).toBeCloseTo(0.35);
    });
  });
});
