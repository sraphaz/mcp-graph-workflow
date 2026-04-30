/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { BudgetLedger } from "../core/llm/budget.js";
import { LlmBudgetExceededError } from "../core/llm/errors.js";

function migratedDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db);
  // Seed project so FK constraints don't bite ledger inserts.
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
  ).run("p1", "p1");
  return db;
}

describe("migrations v66 — llm_call_ledger schema", () => {
  it("creates table llm_call_ledger with the expected columns after runMigrations", () => {
    const db = migratedDb();
    const cols = db
      .prepare("PRAGMA table_info(llm_call_ledger)")
      .all() as Array<{ name: string }>;
    const colNames = cols.map((c) => c.name).sort();
    expect(colNames).toEqual(
      [
        "cache_creation_tokens",
        "cached_input_tokens",
        "caller",
        "cell_id",
        "cost_usd",
        "error_kind",
        "fallback_count",
        "id",
        "input_tokens",
        "latency_ms",
        "model",
        "node_id",
        "output_tokens",
        "project_id",
        "provider",
        "provider_used",
        "run_id",
        "session_id",
        "status",
        "ts",
      ].sort(),
    );
  });

  it("creates indexes idx_llm_ledger_{cell,run,ts}", () => {
    const db = migratedDb();
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='llm_call_ledger'")
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);
    expect(names).toContain("idx_llm_ledger_cell");
    expect(names).toContain("idx_llm_ledger_run");
    expect(names).toContain("idx_llm_ledger_ts");
  });

  it("is idempotent — running migrations twice does not fail", () => {
    const db = migratedDb();
    expect(() => runMigrations(db)).not.toThrow();
  });

  it("registers v66 in _migrations tracking table", () => {
    const db = migratedDb();
    const row = db.prepare("SELECT version FROM _migrations WHERE version = 66").get() as
      | { version: number }
      | undefined;
    expect(row?.version).toBe(66);
  });
});

describe("BudgetLedger — guard, record, aggregate", () => {
  let db: Database.Database;
  let ledger: BudgetLedger;

  beforeEach(() => {
    db = migratedDb();
    ledger = new BudgetLedger(db, "p1");
  });

  it("aggregate returns zeros for an empty ledger", () => {
    const agg = ledger.aggregate({ cellId: "node_X" });
    expect(agg.totalUsd).toBe(0);
    expect(agg.callCount).toBe(0);
    expect(agg.byProvider).toEqual({});
  });

  it("record() inserts a row visible via aggregate()", () => {
    ledger.record({
      caller: "browser-harness",
      provider: "anthropic",
      model: "anthropic/claude-haiku-4-5",
      usage: { inputTokens: 1000, outputTokens: 500 },
      costUsd: 0.0035,
      latencyMs: 200,
      status: "ok",
      cellId: "node_X",
    });
    const agg = ledger.aggregate({ cellId: "node_X" });
    expect(agg.callCount).toBe(1);
    expect(agg.totalUsd).toBeCloseTo(0.0035, 6);
    expect(agg.byProvider.anthropic).toBeCloseTo(0.0035, 6);
  });

  it("guard() throws LlmBudgetExceededError when current+estimated > cap", () => {
    ledger.record({
      caller: "browser-harness",
      provider: "anthropic",
      model: "x/y",
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0.8,
      latencyMs: 10,
      status: "ok",
      cellId: "node_X",
    });
    expect(() =>
      ledger.guard({ cellId: "node_X" }, 0.5, { capUsdPerCell: 1.0 }),
    ).toThrow(LlmBudgetExceededError);
  });

  it("guard() does not throw when current+estimated <= cap", () => {
    ledger.record({
      caller: "browser-harness",
      provider: "anthropic",
      model: "x/y",
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0.3,
      latencyMs: 10,
      status: "ok",
      cellId: "node_X",
    });
    expect(() =>
      ledger.guard({ cellId: "node_X" }, 0.5, { capUsdPerCell: 1.0 }),
    ).not.toThrow();
  });

  it("guard() with cap=Infinity never throws", () => {
    expect(() => ledger.guard({ cellId: "node_X" }, 999, {})).not.toThrow();
  });

  it("record() persists a row even when status='error'", () => {
    ledger.record({
      caller: "browser-harness",
      provider: "openrouter",
      model: "openrouter/auto",
      usage: { inputTokens: 0, outputTokens: 0 },
      costUsd: 0,
      latencyMs: 50,
      status: "error",
      errorKind: "transport",
      cellId: "node_X",
    });
    const agg = ledger.aggregate({ cellId: "node_X" });
    expect(agg.callCount).toBe(1);
    expect(agg.totalUsd).toBe(0);
  });

  it("aggregate({runId}) filters by run", () => {
    ledger.record({
      caller: "delegate",
      provider: "anthropic",
      model: "x/y",
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0.1,
      latencyMs: 10,
      status: "ok",
      runId: "run_A",
    });
    ledger.record({
      caller: "delegate",
      provider: "anthropic",
      model: "x/y",
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0.2,
      latencyMs: 10,
      status: "ok",
      runId: "run_B",
    });
    const aggA = ledger.aggregate({ runId: "run_A" });
    expect(aggA.callCount).toBe(1);
    expect(aggA.totalUsd).toBeCloseTo(0.1, 6);
  });
});
