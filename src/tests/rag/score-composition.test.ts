/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Tests for score composition: recency_score, quality_score, and phase signal.
 *
 * node_3b42f8f18aae — "Incorporar recency_score, quality_score e sinal de fase no score final"
 *
 * AC1: computeFinalScore incorporates recency_score, quality_score, and rrfScore
 * AC2: Higher recency_score → higher final score (monotonic)
 * AC3: Higher quality_score → higher final score (monotonic)
 * AC4: Phase signal flows via weightedReciprocalRankFusion (different phases → different scores)
 */

import { describe, it, expect } from "vitest";
import {
  computeFinalScore,
  getRrfWeightsForPhase,
  weightedReciprocalRankFusion,
} from "../../core/rag/multi-strategy-retrieval.js";

describe("computeFinalScore", () => {
  describe("AC1: incorporates all three signals", () => {
    it("should return a number between 0 and 1 for typical inputs", () => {
      const score = computeFinalScore(0.8, 0.7, 0.9);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should return 0 when rrfScore is 0", () => {
      const score = computeFinalScore(0, 0.9, 0.9);
      expect(score).toBe(0);
    });

    it("should be deterministic — same inputs produce same output", () => {
      const a = computeFinalScore(0.5, 0.6, 0.7);
      const b = computeFinalScore(0.5, 0.6, 0.7);
      expect(a).toBe(b);
    });
  });

  describe("AC2: recency_score is monotonic", () => {
    it("higher recency_score should produce higher final score", () => {
      const lowRecency = computeFinalScore(0.8, 0.7, 0.2);
      const highRecency = computeFinalScore(0.8, 0.7, 0.9);
      expect(highRecency).toBeGreaterThan(lowRecency);
    });

    it("zero recency should produce lower score than high recency", () => {
      const noRecency = computeFinalScore(0.6, 0.5, 0.0);
      const freshDoc = computeFinalScore(0.6, 0.5, 1.0);
      expect(freshDoc).toBeGreaterThan(noRecency);
    });
  });

  describe("AC3: quality_score is monotonic", () => {
    it("higher quality_score should produce higher final score", () => {
      const lowQuality = computeFinalScore(0.8, 0.1, 0.5);
      const highQuality = computeFinalScore(0.8, 0.9, 0.5);
      expect(highQuality).toBeGreaterThan(lowQuality);
    });

    it("quality at 0 should be lower than quality at 1", () => {
      const bad = computeFinalScore(0.5, 0.0, 0.5);
      const good = computeFinalScore(0.5, 1.0, 0.5);
      expect(good).toBeGreaterThan(bad);
    });
  });

  describe("edge cases", () => {
    it("all scores at max should return rrfScore (or close)", () => {
      const score = computeFinalScore(1.0, 1.0, 1.0);
      expect(score).toBeCloseTo(1.0, 2);
    });

    it("all quality and recency at 0 should yield a base fraction of rrfScore", () => {
      const score = computeFinalScore(1.0, 0.0, 0.0);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(1.0);
    });
  });
});

describe("phase signal integration", () => {
  describe("AC4: weightedRRF uses phase weights", () => {
    it("IMPLEMENT phase should weight FTS higher than REVIEW", () => {
      const fts = [{ id: "a", score: 0.9 }, { id: "b", score: 0.1 }];
      const graph = [{ id: "b", score: 0.9 }, { id: "a", score: 0.1 }];
      const strategies = [
        { name: "fts", results: fts },
        { name: "graph", results: graph },
      ];

      const implWeights = getRrfWeightsForPhase("IMPLEMENT");
      const reviewWeights = getRrfWeightsForPhase("REVIEW");

      const implResults = weightedReciprocalRankFusion(strategies, implWeights);
      const reviewResults = weightedReciprocalRankFusion(strategies, reviewWeights);

      const implScoreA = implResults.find((r) => r.id === "a")?.rrfScore ?? 0;
      const reviewScoreA = reviewResults.find((r) => r.id === "a")?.rrfScore ?? 0;

      // In IMPLEMENT, FTS weight=0.5 — doc "a" (FTS rank 1) should score higher than in REVIEW
      expect(implScoreA).toBeGreaterThan(reviewScoreA);
    });

    it("ANALYZE phase should be different from VALIDATE phase", () => {
      const analyzeWeights = getRrfWeightsForPhase("ANALYZE");
      const validateWeights = getRrfWeightsForPhase("VALIDATE");
      expect(analyzeWeights).not.toEqual(validateWeights);
    });

    it("undefined phase should use default weights", () => {
      const weights = getRrfWeightsForPhase(undefined);
      expect(weights.fts).toBeGreaterThan(0);
      expect(weights.graph).toBeGreaterThan(0);
      expect(weights.recency).toBeGreaterThan(0);
    });
  });
});
