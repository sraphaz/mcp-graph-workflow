/**
 * Tests for Adaptive RRF Weights by lifecycle phase.
 *
 * Task 3.2 (node_4b7ee95ab8ee) — Epic: BM25+ and RRF Upgrades
 *
 * AC1: REVIEW vs IMPLEMENT produce different results for same input
 * AC2: No phase = v6.x default weights (backward compat)
 * AC3: IMPLEMENT phase favors FTS-matched docs
 * AC4: All preset weights sum to 1.0
 */

import { describe, it, expect } from "vitest";
import {
  getRrfWeightsForPhase,
  PHASE_RRF_PRESETS,
  weightedReciprocalRankFusion,
} from "../core/rag/multi-strategy-retrieval.js";

describe("Adaptive RRF Phase Presets", () => {
  // ── AC4: weights sum to 1.0 ──
  describe("AC4: weight invariant", () => {
    it("should have weights summing to 1.0 for every preset", () => {
      for (const [_phase, weights] of Object.entries(PHASE_RRF_PRESETS)) {
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
      }
    });

    it("should have default preset summing to 1.0", () => {
      const weights = getRrfWeightsForPhase(undefined);
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  // ── AC2: backward compat ──
  describe("AC2: backward compatibility", () => {
    it("should return default v6.x weights when phase is undefined", () => {
      const weights = getRrfWeightsForPhase(undefined);

      expect(weights.fts).toBe(0.4);
      expect(weights.graph).toBe(0.3);
      expect(weights.recency).toBe(0.2);
      expect(weights.quality).toBe(0.1);
    });

    it("should return default weights for unknown phase", () => {
      const weights = getRrfWeightsForPhase("UNKNOWN_PHASE" as string);

      expect(weights.fts).toBe(0.4);
    });
  });

  // ── AC1: different phases produce different results ──
  describe("AC1: phase-aware differentiation", () => {
    it("should produce different rankings for REVIEW vs IMPLEMENT", () => {
      const ftsResults = [
        { id: "doc_fts_match", score: 0.9 },
        { id: "doc_graph_hub", score: 0.3 },
      ];
      const graphResults = [
        { id: "doc_graph_hub", score: 0.95 },
        { id: "doc_fts_match", score: 0.2 },
      ];

      const strategies = [
        { name: "fts", results: ftsResults },
        { name: "graph", results: graphResults },
      ];

      const implementWeights = getRrfWeightsForPhase("IMPLEMENT");
      const reviewWeights = getRrfWeightsForPhase("REVIEW");

      const implementResults = weightedReciprocalRankFusion(strategies, implementWeights);
      const reviewResults = weightedReciprocalRankFusion(strategies, reviewWeights);

      // Both should return results
      expect(implementResults.length).toBeGreaterThan(0);
      expect(reviewResults.length).toBeGreaterThan(0);

      // Rankings should differ — IMPLEMENT favors FTS, REVIEW favors Graph
      // At minimum the scores should be different
      const implScoreDoc1 = implementResults.find((r) => r.id === "doc_fts_match")?.rrfScore ?? 0;
      const revScoreDoc1 = reviewResults.find((r) => r.id === "doc_fts_match")?.rrfScore ?? 0;
      expect(implScoreDoc1).not.toBe(revScoreDoc1);
    });

    it("should have higher FTS weight in IMPLEMENT than REVIEW", () => {
      const impl = getRrfWeightsForPhase("IMPLEMENT");
      const review = getRrfWeightsForPhase("REVIEW");

      expect(impl.fts).toBeGreaterThan(review.fts);
    });

    it("should have higher Graph weight in REVIEW than IMPLEMENT", () => {
      const impl = getRrfWeightsForPhase("IMPLEMENT");
      const review = getRrfWeightsForPhase("REVIEW");

      expect(review.graph).toBeGreaterThan(impl.graph);
    });
  });

  // ── AC3: IMPLEMENT favors exact match ──
  describe("AC3: IMPLEMENT favors FTS exact match", () => {
    it("should rank FTS-matched doc higher in IMPLEMENT phase", () => {
      const ftsResults = [
        { id: "exact_match", score: 0.95 },
        { id: "graph_hub", score: 0.1 },
      ];
      const graphResults = [
        { id: "graph_hub", score: 0.99 },
        { id: "exact_match", score: 0.05 },
      ];
      const recencyResults = [
        { id: "exact_match", score: 0.5 },
        { id: "graph_hub", score: 0.4 },
      ];

      const strategies = [
        { name: "fts", results: ftsResults },
        { name: "graph", results: graphResults },
        { name: "recency", results: recencyResults },
      ];

      const implWeights = getRrfWeightsForPhase("IMPLEMENT");
      const results = weightedReciprocalRankFusion(strategies, implWeights);

      // exact_match should rank first in IMPLEMENT (FTS weight = 0.5)
      expect(results[0].id).toBe("exact_match");
    });
  });

  // ── Preset content ──
  describe("preset values", () => {
    it("should have IMPLEMENT preset with FTS=0.5", () => {
      expect(PHASE_RRF_PRESETS.IMPLEMENT.fts).toBe(0.5);
    });

    it("should have REVIEW preset with Graph=0.5", () => {
      expect(PHASE_RRF_PRESETS.REVIEW.graph).toBe(0.5);
    });

    it("should have ANALYZE preset with Community=0.3", () => {
      expect(PHASE_RRF_PRESETS.ANALYZE.community).toBe(0.3);
    });
  });
});
