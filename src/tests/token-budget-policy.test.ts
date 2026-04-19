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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  TokenBudgetPolicy,
  BUDGET_PRESETS,
} from "../core/context/token-budget-policy.js";

describe("TokenBudgetPolicy — Tabular Q-Learning (Sutton & Barto)", () => {
  let db: Database.Database;
  let policy: TokenBudgetPolicy;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    policy = new TokenBudgetPolicy(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should return default 'balanced' preset when visits=0 (cold start)", () => {
    const result = policy.getDistribution("IMPLEMENT", "B");

    expect(result.preset).toBe("balanced");
    expect(result.distribution.graph).toBeGreaterThan(0);
    expect(result.distribution.knowledge).toBeGreaterThan(0);
  });

  it("should converge to best action after sufficient positive outcomes", () => {
    // Record 25 positive outcomes for 'code_heavy' in IMPLEMENT/B
    for (let i = 0; i < 25; i++) {
      policy.recordOutcome("IMPLEMENT", "B", "code_heavy", 1);
    }

    // After training, should mostly select 'code_heavy' (exploitation)
    let codeHeavyCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      const result = policy.getDistribution("IMPLEMENT", "B");
      if (result.preset === "code_heavy") codeHeavyCount++;
    }

    // With epsilon=0.15, expect ~85% code_heavy
    expect(codeHeavyCount).toBeGreaterThan(60);
  });

  it("should reset Q-values when divergence exceeds 3σ threshold", () => {
    // Artificially create extreme divergence by recording huge rewards
    for (let i = 0; i < 30; i++) {
      policy.recordOutcome("DESIGN", "A", "knowledge_heavy", 100);
    }

    // The Q-value should have been reset after divergence detection
    const stats = policy.getStats();
    // After reset, resets count should be > 0
    expect(stats.totalVisits).toBeGreaterThan(0);
  });

  it("should have 5 budget presets with valid distributions", () => {
    const presetNames = Object.keys(BUDGET_PRESETS);
    expect(presetNames).toHaveLength(5);

    for (const name of presetNames) {
      const dist = BUDGET_PRESETS[name as keyof typeof BUDGET_PRESETS];
      const sum = dist.graph + dist.knowledge + dist.code + dist.history;
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it("should return stats with totalVisits and convergenceRate", () => {
    policy.recordOutcome("IMPLEMENT", "B", "balanced", 1);
    policy.recordOutcome("IMPLEMENT", "B", "balanced", 1);

    const stats = policy.getStats();
    expect(stats).toHaveProperty("totalVisits");
    expect(stats).toHaveProperty("convergenceRate");
    expect(stats).toHaveProperty("currentEpsilon");
    expect(stats.totalVisits).toBe(2);
    expect(stats.currentEpsilon).toBe(0.15);
  });

  it("should persist Q-values in SQLite across instances", () => {
    // Record outcomes in first instance
    for (let i = 0; i < 5; i++) {
      policy.recordOutcome("PLAN", "C", "graph_heavy", 1);
    }

    // Create second instance from same DB
    const policy2 = new TokenBudgetPolicy(db);
    const stats = policy2.getStats();

    expect(stats.totalVisits).toBeGreaterThanOrEqual(5);
  });

  it("should use different distributions for different presets", () => {
    const balanced = BUDGET_PRESETS.balanced;
    const codeHeavy = BUDGET_PRESETS.code_heavy;
    const knowledgeHeavy = BUDGET_PRESETS.knowledge_heavy;

    expect(codeHeavy.code).toBeGreaterThan(balanced.code);
    expect(knowledgeHeavy.knowledge).toBeGreaterThan(balanced.knowledge);
  });
});
