/**
 * Harnessability Score — Composite metric for agent-readiness
 *
 * Combines 4 dimensions:
 * - Type Coverage (30%): files without `any` usage
 * - Test Coverage (30%): modules with test files
 * - Fitness Score (20%): architecture fitness functions passing
 * - Docs Coverage (20%): CLAUDE.md, README, rules, docs/
 *
 * Based on: "Harness Engineering for Coding Agent Users" (Böckeler, Thoughtworks 2026)
 * Concept: Harnessability — structural properties that enable effective harnesses.
 */

export interface HarnessabilityInput {
  typeScore: number;
  testScore: number;
  fitnessScore: number;
  docsScore: number;
}

export interface DimensionBreakdown {
  score: number;
  weight: number;
}

export interface HarnessabilityResult {
  score: number;
  grade: "A" | "B" | "C" | "D";
  breakdown: {
    types: DimensionBreakdown;
    tests: DimensionBreakdown;
    fitness: DimensionBreakdown;
    docs: DimensionBreakdown;
  };
}

const WEIGHTS = {
  types: 0.3,
  tests: 0.3,
  fitness: 0.2,
  docs: 0.2,
} as const;

function gradeFromScore(score: number): "A" | "B" | "C" | "D" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

/**
 * Compute the composite harnessability score from 4 dimensions.
 */
export function computeHarnessabilityScore(input: HarnessabilityInput): HarnessabilityResult {
  const score =
    input.typeScore * WEIGHTS.types +
    input.testScore * WEIGHTS.tests +
    input.fitnessScore * WEIGHTS.fitness +
    input.docsScore * WEIGHTS.docs;

  const rounded = Math.round(score * 10) / 10;

  return {
    score: rounded,
    grade: gradeFromScore(rounded),
    breakdown: {
      types: { score: input.typeScore, weight: WEIGHTS.types },
      tests: { score: input.testScore, weight: WEIGHTS.tests },
      fitness: { score: input.fitnessScore, weight: WEIGHTS.fitness },
      docs: { score: input.docsScore, weight: WEIGHTS.docs },
    },
  };
}
