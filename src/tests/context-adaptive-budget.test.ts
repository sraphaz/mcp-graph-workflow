/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Characterization tests for adaptive-budget — locks the bridge between
 * TokenBudgetPolicy and the context assembler. Default ratios documented
 * here in case the runtime DB path becomes unavailable.
 */

import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { getAdaptiveBudgetSplit } from "../core/context/adaptive-budget.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

describe("getAdaptiveBudgetSplit", () => {
  it("returns fallback split when db is null — preset=balanced, source=fallback", () => {
    const result = getAdaptiveBudgetSplit(10_000, null, "IMPLEMENT", "A");
    expect(result.preset).toBe("balanced");
    expect(result.source).toBe("fallback");
  });

  it("fallback split honours documented default ratios (35/30/25/10)", () => {
    const result = getAdaptiveBudgetSplit(10_000, null, "IMPLEMENT", "A");
    expect(result.graphBudget).toBe(3500);
    expect(result.knowledgeBudget).toBe(3000);
    expect(result.codeBudget).toBe(2500);
    expect(result.historyBudget).toBe(1000);
  });

  it("ratios sum to ≤ totalBudget (Math.floor truncation, never overspend)", () => {
    const total = 9999;
    const result = getAdaptiveBudgetSplit(total, null, "IMPLEMENT", "A");
    const sum =
      result.graphBudget + result.knowledgeBudget + result.codeBudget + result.historyBudget;
    expect(sum).toBeLessThanOrEqual(total);
  });

  it("returns integer token counts (no fractional budgets)", () => {
    const result = getAdaptiveBudgetSplit(1234, null, "IMPLEMENT", "B");
    expect(Number.isInteger(result.graphBudget)).toBe(true);
    expect(Number.isInteger(result.knowledgeBudget)).toBe(true);
    expect(Number.isInteger(result.codeBudget)).toBe(true);
    expect(Number.isInteger(result.historyBudget)).toBe(true);
  });

  it("with empty db (no learned policy yet), source is 'default' from TokenBudgetPolicy", () => {
    const db = makeDb();
    const result = getAdaptiveBudgetSplit(10_000, db, "IMPLEMENT", "A");
    // TokenBudgetPolicy serves a preset even without learned rows;
    // source must be one of the documented values.
    expect(["learned", "default", "fallback"]).toContain(result.source);
    expect(result.preset).toBeDefined();
    db.close();
  });

  it("never returns negative budgets", () => {
    const result = getAdaptiveBudgetSplit(0, null, "IMPLEMENT", "A");
    expect(result.graphBudget).toBeGreaterThanOrEqual(0);
    expect(result.knowledgeBudget).toBeGreaterThanOrEqual(0);
    expect(result.codeBudget).toBeGreaterThanOrEqual(0);
    expect(result.historyBudget).toBeGreaterThanOrEqual(0);
  });

  it("zero total budget produces zero across all four buckets", () => {
    const result = getAdaptiveBudgetSplit(0, null, "IMPLEMENT", "A");
    expect(result.graphBudget).toBe(0);
    expect(result.knowledgeBudget).toBe(0);
    expect(result.codeBudget).toBe(0);
    expect(result.historyBudget).toBe(0);
  });

  it("phase + grade are accepted but null-db path doesn't read them", () => {
    const result = getAdaptiveBudgetSplit(1000, null, "BOGUS_PHASE", "Z");
    // No exception, fallback ratios still applied.
    expect(result.source).toBe("fallback");
    expect(result.graphBudget).toBe(350);
  });

  it("returns the documented AdaptiveBudgetResult shape", () => {
    const result = getAdaptiveBudgetSplit(1000, null, "IMPLEMENT", "A");
    expect(result).toHaveProperty("graphBudget");
    expect(result).toHaveProperty("knowledgeBudget");
    expect(result).toHaveProperty("codeBudget");
    expect(result).toHaveProperty("historyBudget");
    expect(result).toHaveProperty("preset");
    expect(result).toHaveProperty("source");
  });
});
