/**
 * Phase metadata utilities for knowledge indexers.
 * Provides consistent phase tagging across all knowledge sources.
 *
 * Enhanced with dynamic boosting:
 * - Adjacent phase awareness (prev/next phases get bonus)
 * - Source type relevance per phase
 * - Recency-weighted phase boosting
 */

import type { LifecyclePhase } from "../planner/lifecycle-phase.js";

/**
 * Ordered lifecycle phases for adjacency calculations.
 */
export const PHASE_ORDER: readonly LifecyclePhase[] = [
  "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
] as const;

/**
 * Phase boost weights for RAG search.
 * Maps: current phase → source phase → boost multiplier.
 * Higher boost = more relevant for the current phase.
 *
 * Enhanced: all adjacent phases now included with graduated boosting.
 */
export const PHASE_BOOST_WEIGHTS: Record<LifecyclePhase, Partial<Record<LifecyclePhase, number>>> = {
  ANALYZE: {
    ANALYZE: 2.0,
    LISTENING: 1.5,
    DESIGN: 1.3,
  },
  DESIGN: {
    DESIGN: 2.0,
    ANALYZE: 1.5,
    PLAN: 1.3,
  },
  PLAN: {
    PLAN: 2.0,
    DESIGN: 1.5,
    IMPLEMENT: 1.3,
    ANALYZE: 1.1,
  },
  IMPLEMENT: {
    IMPLEMENT: 2.0,
    PLAN: 1.5,
    VALIDATE: 1.3,
    DESIGN: 1.2,
  },
  VALIDATE: {
    VALIDATE: 2.0,
    IMPLEMENT: 2.0,
    REVIEW: 1.3,
    ANALYZE: 1.1,
  },
  REVIEW: {
    REVIEW: 2.0,
    VALIDATE: 2.0,
    IMPLEMENT: 1.5,
    HANDOFF: 1.3,
  },
  HANDOFF: {
    HANDOFF: 2.0,
    REVIEW: 1.5,
    DEPLOY: 1.3,
    VALIDATE: 1.1,
  },
  DEPLOY: {
    DEPLOY: 2.0,
    HANDOFF: 1.5,
    REVIEW: 1.3,
    LISTENING: 1.2,
  },
  LISTENING: {
    LISTENING: 2.0,
    DEPLOY: 1.3,
    ANALYZE: 1.5,
    VALIDATE: 1.1,
  },
};

/**
 * Source types that are most relevant per lifecycle phase.
 * Documents matching these source types get an additional boost.
 */
export const PHASE_SOURCE_AFFINITY: Record<LifecyclePhase, Record<string, number>> = {
  ANALYZE: { prd: 1.5, memory: 1.3, journey: 1.2 },
  DESIGN: { memory: 1.4, prd: 1.3, docs: 1.2, constitution: 1.5 },
  PLAN: { memory: 1.3, prd: 1.2, docs: 1.2 },
  IMPLEMENT: { code_context: 1.5, docs: 1.4, memory: 1.2 },
  VALIDATE: { code_context: 1.3, benchmark: 1.4, web_capture: 1.3, constitution: 1.3 },
  REVIEW: { code_context: 1.4, memory: 1.3, benchmark: 1.2, constitution: 1.3 },
  HANDOFF: { memory: 1.4, docs: 1.3, prd: 1.2 },
  DEPLOY: { docs: 1.3, memory: 1.2, benchmark: 1.2 },
  LISTENING: { web_capture: 1.3, memory: 1.3, journey: 1.2 },
};

/**
 * Get the phase boost multiplier for a knowledge document in the current phase.
 * Returns 1.0 (neutral) if no specific boost is defined.
 */
export function getPhaseBoost(currentPhase: LifecyclePhase, docPhase: string | undefined): number {
  if (!docPhase) return 1.0;
  const weights = PHASE_BOOST_WEIGHTS[currentPhase];
  return weights[docPhase as LifecyclePhase] ?? 1.0;
}

/**
 * Apply phase boost to a BM25 score.
 * Scores are positive (higher = better match) after negation in the store layer.
 * Boosting means multiplying by the weight (making score higher = more relevant).
 */
export function applyPhaseBoost(score: number, boost: number): number {
  if (boost <= 0) return score;
  return score * boost;
}

/**
 * Get dynamic phase boost combining phase affinity + source type affinity.
 * Returns a combined multiplier that considers both what phase the doc is from
 * AND what type of content it is, relative to the current phase.
 */
export function getDynamicPhaseBoost(
  currentPhase: LifecyclePhase,
  docPhase: string | undefined,
  sourceType: string | undefined,
): number {
  const phaseBoost = getPhaseBoost(currentPhase, docPhase);
  const sourceBoost = getSourceAffinity(currentPhase, sourceType);

  // Combine: phase boost × source affinity (geometric mean to avoid over-boosting)
  return Math.sqrt(phaseBoost * sourceBoost);
}

/**
 * Get source type affinity for the current phase.
 * Returns 1.0 (neutral) if no specific affinity is defined.
 */
export function getSourceAffinity(currentPhase: LifecyclePhase, sourceType: string | undefined): number {
  if (!sourceType) return 1.0;
  const affinities = PHASE_SOURCE_AFFINITY[currentPhase];
  return affinities[sourceType] ?? 1.0;
}

/**
 * Get adjacent phases (previous and next in lifecycle order).
 * Useful for context expansion when the current phase needs knowledge from neighbors.
 */
export function getAdjacentPhases(currentPhase: LifecyclePhase): { prev: LifecyclePhase | null; next: LifecyclePhase | null } {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  return {
    prev: idx > 0 ? PHASE_ORDER[idx - 1] : null,
    next: idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null,
  };
}
