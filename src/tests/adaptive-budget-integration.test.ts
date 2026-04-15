import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  getAdaptiveBudgetSplit,
} from "../core/context/adaptive-budget.js";
import { TokenBudgetPolicy } from "../core/context/token-budget-policy.js";

describe("Adaptive Budget Integration (Q-Learning → Context Assembler)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should return default budget split when policy has no training data", () => {
    const result = getAdaptiveBudgetSplit(4000, db, "IMPLEMENT", "B");

    expect(result.graphBudget).toBeGreaterThan(0);
    expect(result.knowledgeBudget).toBeGreaterThan(0);
    expect(result.graphBudget + result.knowledgeBudget).toBeLessThanOrEqual(4000);
    expect(result.source).toBe("default");
  });

  it("should use fallback when db is null (backward compat)", () => {
    const result = getAdaptiveBudgetSplit(4000, null, "IMPLEMENT", "B");

    expect(result.graphBudget).toBeGreaterThan(0);
    expect(result.knowledgeBudget).toBeGreaterThan(0);
    expect(result.source).toBe("fallback");
  });

  it("should return learned split after sufficient training", () => {
    // Train the policy with 25 outcomes
    const policy = new TokenBudgetPolicy(db);

    for (let i = 0; i < 25; i++) {
      policy.recordOutcome("DESIGN", "A", "knowledge_heavy", 1);
    }

    const result = getAdaptiveBudgetSplit(6000, db, "DESIGN", "A");

    // After training, should use learned distribution
    expect(result.source).toBe("learned");
    expect(result.preset).toBeDefined();
  });

  it("should include _adaptive_budget metadata", () => {
    const result = getAdaptiveBudgetSplit(4000, db, "PLAN", "C");

    expect(result).toHaveProperty("graphBudget");
    expect(result).toHaveProperty("knowledgeBudget");
    expect(result).toHaveProperty("codeBudget");
    expect(result).toHaveProperty("preset");
    expect(result).toHaveProperty("source");
  });

  it("should respect total budget constraint", () => {
    const totalBudget = 8000;
    const result = getAdaptiveBudgetSplit(totalBudget, db, "IMPLEMENT", "A");

    const total = result.graphBudget + result.knowledgeBudget + result.codeBudget + result.historyBudget;
    expect(total).toBeLessThanOrEqual(totalBudget + 1); // allow rounding
  });
});
