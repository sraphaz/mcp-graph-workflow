/**
 * Tests for decision-fitness.ts — Decision Fitness Scoring Engine.
 *
 * Covers all 4 acceptance criteria:
 * AC1: scoreFriction() — keyword-based friction scoring (0-100)
 * AC2: scoreOptimality() — JTBD Jaccard overlap scoring (0-100)
 * AC3: scoreReversibility() — lock-in vs reversible keyword detection (0-100)
 * AC4: computeDecisionFitness() — composite weighted score + grade
 */

import { describe, it, expect } from "vitest";
import {
  scoreFriction,
  scoreOptimality,
  scoreReversibility,
  computeDecisionFitness,
  type FrictionResult,
  type OptimalityResult,
  type ReversibilityResult,
  type DecisionFitnessResult,
} from "../core/designer/decision-fitness.js";
import type { GraphNode } from "../core/graph/graph-types.js";

function makeDecisionNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node_test_decision",
    type: "decision",
    title: "ADR-001: Use SQLite for storage",
    description: "## Status: Accepted\n## Context: Need local storage.\n## Decision: Use SQLite.\n## Consequences: Fast, local.",
    status: "backlog",
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("decision-fitness", () => {
  // ── AC1: scoreFriction ──
  describe("scoreFriction", () => {
    it("should return score 100 for decision with zero friction keywords", () => {
      const node = makeDecisionNode({
        description: "## Decision: Use built-in Node.js fs module. No additional work needed.",
      });
      const result: FrictionResult = scoreFriction(node);
      expect(result.score).toBe(100);
      expect(result.detectedKeywords).toHaveLength(0);
    });

    it("should decrease score by 20 per detected friction keyword", () => {
      const node = makeDecisionNode({
        description: "## Decision: npm install required. Manual step to configure. Extra dependency needed.",
      });
      const result = scoreFriction(node);
      expect(result.score).toBeLessThanOrEqual(60);
      expect(result.detectedKeywords.length).toBeGreaterThanOrEqual(2);
    });

    it("should clamp score to minimum 0", () => {
      const node = makeDecisionNode({
        description: "npm install. manual step. configuration required. setup. extra dependency. another setup.",
      });
      const result = scoreFriction(node);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("should include justification in result", () => {
      const node = makeDecisionNode({
        description: "## Decision: Requires npm install and manual configuration required.",
      });
      const result = scoreFriction(node);
      expect(result.justification).toBeDefined();
      expect(typeof result.justification).toBe("string");
    });
  });

  // ── AC2: scoreOptimality ──
  describe("scoreOptimality", () => {
    it("should return 100 when all JTBDs are matched", () => {
      const node = makeDecisionNode({
        description: "## Decision: Use local SQLite storage for fast data access and persistence.",
      });
      const jtbds = [
        { situation: "using the CLI", motivation: "store data locally", outcome: "fast access", sourceNodeId: "n1" },
      ];
      const result: OptimalityResult = scoreOptimality(node, jtbds);
      expect(result.score).toBe(100);
      expect(result.matchedJtbds).toHaveLength(1);
      expect(result.unmatchedJtbds).toHaveLength(0);
    });

    it("should return 0 when no JTBDs match", () => {
      const node = makeDecisionNode({
        description: "## Decision: Use Redis for caching.",
      });
      const jtbds = [
        { situation: "building ML pipeline", motivation: "train models", outcome: "predict outcomes", sourceNodeId: "n1" },
      ];
      const result = scoreOptimality(node, jtbds);
      expect(result.score).toBe(0);
      expect(result.unmatchedJtbds).toHaveLength(1);
    });

    it("should return proportional score for partial JTBD matches", () => {
      const node = makeDecisionNode({
        description: "## Decision: Use SQLite for local storage with fast queries.",
      });
      const jtbds = [
        { situation: "offline", motivation: "local storage", outcome: "fast queries", sourceNodeId: "n1" },
        { situation: "cloud", motivation: "scale globally", outcome: "high availability", sourceNodeId: "n2" },
      ];
      const result = scoreOptimality(node, jtbds);
      expect(result.score).toBe(50); // 1 of 2 matched
      expect(result.matchedJtbds).toHaveLength(1);
      expect(result.unmatchedJtbds).toHaveLength(1);
    });

    it("should return 100 when no JTBDs provided (vacuously true)", () => {
      const node = makeDecisionNode();
      const result = scoreOptimality(node, []);
      expect(result.score).toBe(100);
    });
  });

  // ── AC3: scoreReversibility ──
  describe("scoreReversibility", () => {
    it("should return 100 for fully reversible decision", () => {
      const node = makeDecisionNode({
        description: "## Decision: Use feature flag for gradual rollout. Optional config with fallback. Easy rollback.",
      });
      const result: ReversibilityResult = scoreReversibility(node);
      expect(result.score).toBe(100);
      expect(result.reversibleKeywords.length).toBeGreaterThan(0);
      expect(result.lockInKeywords).toHaveLength(0);
    });

    it("should return 0 for full lock-in decision", () => {
      const node = makeDecisionNode({
        description: "## Decision: Schema migration with vendor lock-in. Breaking change. Permanent data restructuring.",
      });
      const result = scoreReversibility(node);
      expect(result.score).toBe(0);
      expect(result.lockInKeywords.length).toBeGreaterThan(0);
      expect(result.reversibleKeywords).toHaveLength(0);
    });

    it("should return proportional score for mixed signals", () => {
      const node = makeDecisionNode({
        description: "## Decision: Schema migration needed but with feature flag for gradual rollout and rollback plan.",
      });
      const result = scoreReversibility(node);
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    it("should return 50 when no keywords detected (neutral)", () => {
      const node = makeDecisionNode({
        description: "## Decision: Use the standard approach.",
      });
      const result = scoreReversibility(node);
      expect(result.score).toBe(50);
    });
  });

  // ── AC4: computeDecisionFitness ──
  describe("computeDecisionFitness", () => {
    it("should compute weighted composite score (friction 40%, optimality 35%, reversibility 25%)", () => {
      const result: DecisionFitnessResult = computeDecisionFitness(100, 100, 100);
      expect(result.composite).toBe(100);
      expect(result.grade).toBe("A");
    });

    it("should apply correct weights", () => {
      // friction=50*0.4=20, optimality=50*0.35=17.5, reversibility=50*0.25=12.5 = 50
      const result = computeDecisionFitness(50, 50, 50);
      expect(result.composite).toBe(50);
    });

    it("should grade A for score >= 80", () => {
      const result = computeDecisionFitness(90, 80, 70);
      // 90*0.4 + 80*0.35 + 70*0.25 = 36 + 28 + 17.5 = 81.5
      expect(result.grade).toBe("A");
    });

    it("should grade B for score >= 60 and < 80", () => {
      const result = computeDecisionFitness(70, 60, 60);
      // 70*0.4 + 60*0.35 + 60*0.25 = 28 + 21 + 15 = 64
      expect(result.grade).toBe("B");
    });

    it("should grade C for score >= 40 and < 60", () => {
      const result = computeDecisionFitness(50, 50, 40);
      // 50*0.4 + 50*0.35 + 40*0.25 = 20 + 17.5 + 10 = 47.5
      expect(result.grade).toBe("C");
    });

    it("should grade D for score >= 20 and < 40", () => {
      const result = computeDecisionFitness(30, 30, 30);
      // 30*0.4 + 30*0.35 + 30*0.25 = 12 + 10.5 + 7.5 = 30
      expect(result.grade).toBe("D");
    });

    it("should grade F for score < 20", () => {
      const result = computeDecisionFitness(10, 10, 10);
      // 10*0.4 + 10*0.35 + 10*0.25 = 4 + 3.5 + 2.5 = 10
      expect(result.grade).toBe("F");
    });

    it("should include breakdown in result", () => {
      const result = computeDecisionFitness(80, 70, 60);
      expect(result.breakdown).toEqual({
        friction: { score: 80, weight: 0.4 },
        optimality: { score: 70, weight: 0.35 },
        reversibility: { score: 60, weight: 0.25 },
      });
    });
  });
});
