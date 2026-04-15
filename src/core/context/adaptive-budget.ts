/**
 * Adaptive Budget — Bridge between TokenBudgetPolicy and Context Assembler
 *
 * Provides getAdaptiveBudgetSplit() that replaces the fixed 60/30/10 budget
 * with Q-Learning-driven distribution. Falls back gracefully when policy
 * is unavailable or uninitialized.
 *
 * Based on: Sutton & Barto RL applied to context window optimization.
 */

import type Database from "better-sqlite3";
import { TokenBudgetPolicy, type BudgetPresetName } from "./token-budget-policy.js";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface AdaptiveBudgetResult {
  graphBudget: number;
  knowledgeBudget: number;
  codeBudget: number;
  historyBudget: number;
  preset: BudgetPresetName;
  source: "learned" | "default" | "fallback";
}

// ── Default split (backward compat) ─────────────────────

const DEFAULT_GRAPH_RATIO = 0.35;
const DEFAULT_KNOWLEDGE_RATIO = 0.30;
const DEFAULT_CODE_RATIO = 0.25;
const DEFAULT_HISTORY_RATIO = 0.10;

// ── Public API ──────────────────────────────────────────

/**
 * Get adaptive budget split for context assembly.
 * Uses Q-Learning policy when available, falls back to fixed ratios.
 *
 * @param totalBudget - Total token budget
 * @param db - SQLite database (null = fallback mode)
 * @param phase - Current lifecycle phase
 * @param grade - Current harness grade (A/B/C/D)
 */
export function getAdaptiveBudgetSplit(
  totalBudget: number,
  db: Database.Database | null,
  phase: string,
  grade: string,
): AdaptiveBudgetResult {
  // Fallback when no DB available
  if (!db) {
    return applyRatios(totalBudget, DEFAULT_GRAPH_RATIO, DEFAULT_KNOWLEDGE_RATIO, DEFAULT_CODE_RATIO, DEFAULT_HISTORY_RATIO, "balanced", "fallback");
  }

  try {
    const policy = new TokenBudgetPolicy(db);
    const result = policy.getDistribution(phase, grade);
    const dist = result.distribution;

    logger.debug("adaptive-budget:split", {
      phase, grade, preset: result.preset, source: result.source,
    });

    return applyRatios(
      totalBudget,
      dist.graph,
      dist.knowledge,
      dist.code,
      dist.history,
      result.preset,
      result.source,
    );
  } catch (err) {
    logger.warn("adaptive-budget:fallback", { error: String(err) });
    return applyRatios(totalBudget, DEFAULT_GRAPH_RATIO, DEFAULT_KNOWLEDGE_RATIO, DEFAULT_CODE_RATIO, DEFAULT_HISTORY_RATIO, "balanced", "fallback");
  }
}

/**
 * Apply ratios to total budget, producing integer token counts.
 */
function applyRatios(
  total: number,
  graph: number,
  knowledge: number,
  code: number,
  history: number,
  preset: BudgetPresetName,
  source: "learned" | "default" | "fallback",
): AdaptiveBudgetResult {
  return {
    graphBudget: Math.floor(total * graph),
    knowledgeBudget: Math.floor(total * knowledge),
    codeBudget: Math.floor(total * code),
    historyBudget: Math.floor(total * history),
    preset,
    source,
  };
}
