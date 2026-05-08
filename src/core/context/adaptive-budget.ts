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
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "adaptive-budget.ts" });

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
    const resultValue = policy.getDistribution(phase, grade);
    const dist = resultValue.distribution;

    log.debug("adaptive-budget:split", {
      phase, grade, preset: resultValue.preset, source: resultValue.source,
    });

    return applyRatios(
      totalBudget,
      dist.graph,
      dist.knowledge,
      dist.code,
      dist.history,
      resultValue.preset,
      resultValue.source,
    );
  } catch (err) {
    log.warn("adaptive-budget:fallback", { error: String(err) });
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
