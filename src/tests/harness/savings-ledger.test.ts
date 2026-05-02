/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * savings-ledger — DB integration of the harness savings calculator.
 *
 * AC1 — recordBlock inserts a row with computed savings + confidence
 * AC2 — getSessionTokensConsumed sums input/output/cache from llm_call_ledger
 * AC3 — getBaseline averages over past rows of the same blockType
 * AC4 — aggregateSavings groups by blockType, returns totals
 * AC5 — empty DB → zero baseline + zero session tokens, source=unknown
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../../core/store/migrations.js";
import {
  recordBlock,
  getSessionTokensConsumed,
  getBaselineContinuation,
  aggregateSavings,
} from "../../core/harness/savings-ledger.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p', 't', '2026-01-01', '2026-01-01')",
  ).run();
  return db;
}

function insertLlmCall(
  db: Database.Database,
  sessionId: string,
  inputTok: number,
  outputTok: number,
  cacheCreate: number,
  ts: number,
): void {
  db.prepare(
    `INSERT INTO llm_call_ledger
      (id, ts, project_id, caller, provider, model,
       input_tokens, output_tokens, cache_creation_tokens,
       cost_usd, status, session_id)
     VALUES (?, ?, 'p', 'test', 'anthropic', 'claude-opus-4-7', ?, ?, ?, 0, 'ok', ?)`,
  ).run(
    `call_${ts}_${Math.random().toString(36).slice(2, 6)}`,
    ts,
    inputTok,
    outputTok,
    cacheCreate,
    sessionId,
  );
}

describe("savings-ledger DB", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("AC2 — getSessionTokensConsumed sums input + output + cache_creation", () => {
    insertLlmCall(db, "sess1", 100, 200, 50, 1);
    insertLlmCall(db, "sess1", 300, 400, 0, 2);
    insertLlmCall(db, "sess2", 999, 999, 999, 3); // different session — must be excluded

    const total = getSessionTokensConsumed(db, "sess1");
    expect(total).toBe(100 + 200 + 50 + 300 + 400 + 0);
  });

  it("AC2 — empty session returns 0", () => {
    expect(getSessionTokensConsumed(db, "ghost")).toBe(0);
  });

  it("AC3 — getBaselineContinuation returns {avg, n} from past savings rows", () => {
    // Pre-seed: three past blocks of type=regression_gate
    const stmt = db.prepare(
      `INSERT INTO harness_savings_ledger
        (id, project_id, block_type, blocker_module, savings_tokens,
         tokens_consumed, baseline_continuation, baseline_n, confidence,
         source, timestamp)
       VALUES (?, 'p', ?, 'finish_task', ?, 0, ?, 0, 0, 'measured', ?)`,
    );
    stmt.run("r1", "regression_gate", 1000, 5000, "2026-04-01");
    stmt.run("r2", "regression_gate", 2000, 7000, "2026-04-02");
    stmt.run("r3", "regression_gate", 3000, 9000, "2026-04-03");
    stmt.run("r4", "doD_unmet", 999, 999, "2026-04-04"); // different type — must be excluded

    const result = getBaselineContinuation(db, "regression_gate");
    expect(result.n).toBe(3);
    expect(result.avg).toBe(7000); // (5000+7000+9000)/3
  });

  it("AC3 — empty baseline returns {avg: 0, n: 0}", () => {
    const result = getBaselineContinuation(db, "never_seen");
    expect(result).toEqual({ avg: 0, n: 0 });
  });

  it("AC1 — recordBlock inserts a complete row", () => {
    const id = recordBlock(db, {
      projectId: "p",
      blockType: "regression_gate",
      blockerModule: "finish_task",
      nodeId: "node_x",
      sessionId: "sess1",
      tokensConsumed: 4000,
      baselineContinuation: 12_000,
      baselineN: 5,
      evidence: { delta: -7.2, gradeBefore: "A", gradeAfter: "B" },
    });
    expect(id).toMatch(/^harness_savings_/);

    const row = db
      .prepare("SELECT * FROM harness_savings_ledger WHERE id = ?")
      .get(id) as Record<string, unknown>;
    expect(row.block_type).toBe("regression_gate");
    expect(row.blocker_module).toBe("finish_task");
    expect(row.node_id).toBe("node_x");
    expect(row.session_id).toBe("sess1");
    expect(row.savings_tokens).toBe(8000); // 12000 - 4000
    expect(row.confidence).toBeCloseTo(0.5, 3);
    expect(row.source).toBe("measured");
    expect(typeof row.timestamp).toBe("string");
    const evidence = JSON.parse(row.evidence_json as string) as { delta: number };
    expect(evidence.delta).toBe(-7.2);
  });

  it("AC4 — aggregateSavings groups by blockType, returns totals", () => {
    const stmt = db.prepare(
      `INSERT INTO harness_savings_ledger
        (id, project_id, block_type, blocker_module, savings_tokens,
         tokens_consumed, baseline_continuation, baseline_n, confidence,
         source, timestamp)
       VALUES (?, 'p', ?, 'gate', ?, 0, 0, 1, 0.1, 'estimated', '2026-04-30')`,
    );
    stmt.run("a1", "regression_gate", 1000);
    stmt.run("a2", "regression_gate", 2000);
    stmt.run("a3", "doD_unmet", 500);

    const summary = aggregateSavings(db, "p");
    expect(summary.totalSavingsTokens).toBe(3500);
    expect(summary.totalBlocks).toBe(3);
    const regression = summary.byBlockType.find((r) => r.blockType === "regression_gate");
    expect(regression).toEqual({
      blockType: "regression_gate",
      count: 2,
      savingsTokens: 3000,
    });
    const doD = summary.byBlockType.find((r) => r.blockType === "doD_unmet");
    expect(doD).toEqual({ blockType: "doD_unmet", count: 1, savingsTokens: 500 });
  });

  it("AC4 — empty ledger returns zero totals + empty byBlockType", () => {
    const summary = aggregateSavings(db, "p");
    expect(summary.totalSavingsTokens).toBe(0);
    expect(summary.totalBlocks).toBe(0);
    expect(summary.byBlockType).toEqual([]);
  });

  it("AC5 — recordBlock with baselineN=0 stores source='unknown'", () => {
    const id = recordBlock(db, {
      projectId: "p",
      blockType: "first_ever",
      blockerModule: "test",
      tokensConsumed: 100,
      baselineContinuation: 0,
      baselineN: 0,
    });
    const row = db
      .prepare("SELECT source, savings_tokens FROM harness_savings_ledger WHERE id = ?")
      .get(id) as { source: string; savings_tokens: number };
    expect(row.source).toBe("unknown");
    expect(row.savings_tokens).toBe(0);
  });
});
