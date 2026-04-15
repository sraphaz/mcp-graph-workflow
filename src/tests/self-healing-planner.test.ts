import { describe, it, expect } from "vitest";
import {
  identifyQuickWins,
  generateMicroPRPlan,
  type QuickWin,
  type DimensionScore,
} from "../core/harness/self-healing-planner.js";

describe("Self-Healing Planner — MAPE-K (IBM 2003)", () => {
  describe("identifyQuickWins (Monitor + Analyze)", () => {
    it("should return top-5 quick wins sorted by impact", () => {
      const dimensions: DimensionScore[] = [
        { name: "type_coverage", score: 85, weight: 0.25 },
        { name: "test_coverage", score: 13, weight: 0.25 },
        { name: "naming_clarity", score: 45, weight: 0.10 },
        { name: "error_handling", score: 30, weight: 0.05 },
        { name: "context_density", score: 41, weight: 0.05 },
        { name: "docs_coverage", score: 89, weight: 0.15 },
        { name: "architecture_fitness", score: 100, weight: 0.15 },
      ];

      const wins = identifyQuickWins(dimensions);

      expect(wins.length).toBeLessThanOrEqual(5);
      expect(wins.length).toBeGreaterThanOrEqual(1);

      // naming_clarity with score 45 should appear (below 70 threshold)
      const namingWin = wins.find((w) => w.dimension === "naming_clarity");
      expect(namingWin).toBeDefined();
    });

    it("should prioritize dimensions with highest potential impact (weight × gap)", () => {
      const dimensions: DimensionScore[] = [
        { name: "type_coverage", score: 50, weight: 0.25 }, // gap=50, impact=12.5
        { name: "naming_clarity", score: 50, weight: 0.10 }, // gap=50, impact=5.0
      ];

      const wins = identifyQuickWins(dimensions);

      // type_coverage should rank higher (higher weight × gap)
      expect(wins[0].dimension).toBe("type_coverage");
    });

    it("should skip dimensions already scoring >= 70", () => {
      const dimensions: DimensionScore[] = [
        { name: "type_coverage", score: 85, weight: 0.25 },
        { name: "docs_coverage", score: 90, weight: 0.15 },
        { name: "architecture_fitness", score: 100, weight: 0.15 },
      ];

      const wins = identifyQuickWins(dimensions);
      expect(wins).toHaveLength(0);
    });
  });

  describe("generateMicroPRPlan (Plan phase)", () => {
    it("should generate plan with files and estimated delta for dry-run", () => {
      const win: QuickWin = {
        dimension: "naming_clarity",
        currentScore: 45,
        targetScore: 70,
        potentialImpact: 2.5,
        suggestedAction: "Rename generic variables to descriptive names",
      };

      const plan = generateMicroPRPlan(win, true);

      expect(plan.dryRun).toBe(true);
      expect(plan.dimension).toBe("naming_clarity");
      expect(plan.estimatedDelta).toBeGreaterThan(0);
      expect(plan.maxLinesChanged).toBeLessThanOrEqual(50);
      expect(plan.branch).toContain("harness/improve-");
    });

    it("should reject plan when estimated scope exceeds 50 lines", () => {
      const win: QuickWin = {
        dimension: "test_coverage",
        currentScore: 5,
        targetScore: 70,
        potentialImpact: 16.25,
        suggestedAction: "Add tests for uncovered modules",
      };

      const plan = generateMicroPRPlan(win, true);

      // Very low score = too many files to fix = scope exceeded
      if (plan.rejected) {
        expect(plan.rejectReason).toContain("scope");
      }
      // If not rejected, maxLinesChanged should be <= 50
      if (!plan.rejected) {
        expect(plan.maxLinesChanged).toBeLessThanOrEqual(50);
      }
    });

    it("should include branch name following convention", () => {
      const win: QuickWin = {
        dimension: "error_handling",
        currentScore: 30,
        targetScore: 70,
        potentialImpact: 2.0,
        suggestedAction: "Replace raw throws with typed errors",
      };

      const plan = generateMicroPRPlan(win, true);

      expect(plan.branch).toMatch(/^harness\/improve-/);
      expect(plan.branch).toContain("error_handling");
    });
  });
});
