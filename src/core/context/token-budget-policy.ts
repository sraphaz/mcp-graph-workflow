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
 * Token Budget Policy — Adaptive Q-Learning for Context Budget Allocation
 *
 * Tabular Q-Learning with 36 states (9 phases × 4 grades) and 5 actions (budget presets).
 * Learns which budget distribution works best for each lifecycle phase + harness grade.
 *
 * Based on: Reinforcement Learning (Sutton & Barto) — simplified Bellman equation.
 * Q(s,a) ← Q(s,a) + α · (r - Q(s,a))
 *
 * Features:
 * - Epsilon-greedy exploration (15%)
 * - Divergence detection with auto-reset (> 3σ)
 * - Fallback to defaults when visits < 20
 * - Persistence in SQLite (token_budget_policy table)
 */

import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface BudgetDistribution {
  graph: number;
  knowledge: number;
  code: number;
  history: number;
}

export type BudgetPresetName =
  | "graph_heavy"
  | "knowledge_heavy"
  | "balanced"
  | "code_heavy"
  | "minimal";

export interface PolicyResult {
  preset: BudgetPresetName;
  distribution: BudgetDistribution;
  source: "learned" | "default";
}

export interface PolicyStats {
  totalVisits: number;
  convergenceRate: number;
  currentEpsilon: number;
}

// ── Preset Definitions ──────────────────────────────────

export const BUDGET_PRESETS: Record<BudgetPresetName, BudgetDistribution> = {
  graph_heavy: { graph: 0.60, knowledge: 0.20, code: 0.15, history: 0.05 },
  knowledge_heavy: { graph: 0.20, knowledge: 0.55, code: 0.15, history: 0.10 },
  balanced: { graph: 0.35, knowledge: 0.30, code: 0.25, history: 0.10 },
  code_heavy: { graph: 0.15, knowledge: 0.15, code: 0.60, history: 0.10 },
  minimal: { graph: 0.25, knowledge: 0.25, code: 0.25, history: 0.25 },
};

const PRESET_NAMES: BudgetPresetName[] = Object.keys(BUDGET_PRESETS) as BudgetPresetName[];
const DEFAULT_PRESET: BudgetPresetName = "balanced";

// ── Constants ───────────────────────────────────────────

const LEARNING_RATE = 0.1;       // α — how fast Q-values update
const EPSILON = 0.15;            // exploration rate
const MIN_VISITS_FOR_LEARNED = 20; // fallback threshold
const DIVERGENCE_SIGMA = 3;      // reset threshold

// ── Q-Learning Engine ───────────────────────────────────

export class TokenBudgetPolicy {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Get the best budget distribution for a state (phase + harness grade).
   * Uses epsilon-greedy: exploit best Q-value (1-ε) or explore randomly (ε).
   */
  getDistribution(phase: string, grade: string): PolicyResult {
    // Get Q-values for this state
    const rows = this.db.prepare(
      `SELECT action_preset, q_value, visits
       FROM token_budget_policy
       WHERE state_phase = ? AND state_grade = ?`,
    ).all(phase, grade) as Array<{ action_preset: string; q_value: number; visits: number }>;

    const totalVisits = rows.reduce((sum, r) => sum + r.visits, 0);

    // Fallback: insufficient data → use default
    if (totalVisits < MIN_VISITS_FOR_LEARNED) {
      return {
        preset: DEFAULT_PRESET,
        distribution: BUDGET_PRESETS[DEFAULT_PRESET],
        source: "default",
      };
    }

    // Epsilon-greedy selection
    if (Math.random() < EPSILON) {
      // Explore: random action
      const randomIdx = Math.floor(Math.random() * PRESET_NAMES.length);
      const preset = PRESET_NAMES[randomIdx];
      return {
        preset,
        distribution: BUDGET_PRESETS[preset],
        source: "learned",
      };
    }

    // Exploit: best Q-value
    let bestPreset = DEFAULT_PRESET;
    let bestQ = -Infinity;
    for (const row of rows) {
      if (row.q_value > bestQ) {
        bestQ = row.q_value;
        bestPreset = row.action_preset as BudgetPresetName;
      }
    }

    return {
      preset: bestPreset,
      distribution: BUDGET_PRESETS[bestPreset] ?? BUDGET_PRESETS[DEFAULT_PRESET],
      source: "learned",
    };
  }

  /**
   * Record an outcome and update Q-value.
   * Q(s,a) ← Q(s,a) + α · (reward - Q(s,a))
   *
   * Rewards: success=+1, regression=-3, human_intervention=-1
   */
  recordOutcome(
    phase: string,
    grade: string,
    preset: BudgetPresetName,
    reward: number,
  ): void {
    const now = new Date().toISOString();

    // Get current Q-value
    const row = this.db.prepare(
      `SELECT q_value, visits FROM token_budget_policy
       WHERE state_phase = ? AND state_grade = ? AND action_preset = ?`,
    ).get(phase, grade, preset) as { q_value: number; visits: number } | undefined;

    const currentQ = row?.q_value ?? 0;
    const visits = (row?.visits ?? 0) + 1;

    // Bellman update: Q ← Q + α(r - Q)
    const newQ = currentQ + LEARNING_RATE * (reward - currentQ);

    this.db.prepare(
      `UPDATE token_budget_policy
       SET q_value = ?, visits = ?, updated_at = ?
       WHERE state_phase = ? AND state_grade = ? AND action_preset = ?`,
    ).run(newQ, visits, now, phase, grade, preset);

    logger.debug("token-budget-policy:update", {
      phase, grade, preset, reward, oldQ: currentQ, newQ, visits,
    });

    // Divergence check
    this.checkDivergence(phase, grade);
  }

  /**
   * Check if Q-values have diverged beyond 3σ and reset if needed.
   */
  private checkDivergence(phase: string, grade: string): void {
    const rows = this.db.prepare(
      `SELECT q_value FROM token_budget_policy
       WHERE state_phase = ? AND state_grade = ?`,
    ).all(phase, grade) as Array<{ q_value: number }>;

    const values = rows.map((r) => r.q_value);
    if (values.length < 2) return;

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const sigma = Math.sqrt(variance);

    if (sigma === 0) return;

    const maxQ = Math.max(...values);
    if (Math.abs(maxQ - mean) > DIVERGENCE_SIGMA * sigma) {
      logger.warn("token-budget-policy:divergence-reset", {
        phase, grade, maxQ, mean, sigma,
      });

      // Reset Q-values for this state
      this.db.prepare(
        `UPDATE token_budget_policy
         SET q_value = 0, visits = 0, updated_at = ?
         WHERE state_phase = ? AND state_grade = ?`,
      ).run(new Date().toISOString(), phase, grade);
    }
  }

  /**
   * Get aggregate policy statistics.
   */
  getStats(): PolicyStats {
    const resultValue = this.db.prepare(
      `SELECT SUM(visits) as total, COUNT(*) as entries FROM token_budget_policy`,
    ).get() as { total: number; entries: number };

    const nonZero = this.db.prepare(
      `SELECT COUNT(*) as cnt FROM token_budget_policy WHERE visits > 0`,
    ).get() as { cnt: number };

    return {
      totalVisits: resultValue.total ?? 0,
      convergenceRate: resultValue.entries > 0 ? nonZero.cnt / resultValue.entries : 0,
      currentEpsilon: EPSILON,
    };
  }

  /**
   * Reset all Q-values to defaults.
   */
  reset(): void {
    this.db.prepare(
      `UPDATE token_budget_policy SET q_value = 0, visits = 0, updated_at = ?`,
    ).run(new Date().toISOString());

    logger.info("token-budget-policy:reset");
  }
}
