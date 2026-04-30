/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-cost-observability — session-scoped budget tests covering:
 *   1. migration v86 adds session_id column + index
 *   2. ledger.record persists session_id
 *   3. ledger.aggregate filters by session_id
 *   4. ledger.guard throws LlmBudgetExceededError when session cap exceeded
 *   5. ledger.isSessionSoftCapped returns true ≥ 50% of cap
 *   6. gateway.complete() under soft-cap auto-falls-back to cheaper failover entry
 *   7. gateway.complete() under hard-cap throws BudgetExceeded for primary
 *   8. softCapFraction is configurable (e.g. 0.8 instead of default 0.5)
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { BudgetLedger, budgetCapsFromEnv } from "../core/llm/budget.js";
import { LlmGateway } from "../core/llm/gateway.js";
import { ModelRegistry, DEFAULT_MODEL_SEED } from "../core/llm/registry.js";
import { LlmBudgetExceededError } from "../core/llm/errors.js";
import type { ProviderAdapter } from "../core/llm/adapters/base.js";
import type {
  LlmRequest,
  LlmResponse,
  ModelSpec,
  ProviderName,
} from "../core/llm/types.js";

function migratedDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
  ).run("p1", "p1");
  return db;
}

class FakeAdapter implements ProviderAdapter {
  calls = 0;
  constructor(public readonly name: ProviderName) {}
  async generate(req: LlmRequest): Promise<LlmResponse> {
    this.calls += 1;
    return {
      kind: "final",
      model: req.model,
      content: "ok",
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  }
  models(): ModelSpec[] {
    return DEFAULT_MODEL_SEED.filter((m) => m.provider === this.name);
  }
}

describe("migration v86 — session_id on llm_call_ledger", () => {
  it("creates session_id column with index", () => {
    const db = migratedDb();
    const cols = db
      .prepare("PRAGMA table_info(llm_call_ledger)")
      .all() as Array<{ name: string }>;
    expect(cols.map((c) => c.name)).toContain("session_id");
    const idx = db
      .prepare("PRAGMA index_list(llm_call_ledger)")
      .all() as Array<{ name: string }>;
    expect(idx.map((i) => i.name)).toContain("idx_llm_ledger_session");
  });
});

describe("BudgetLedger — session scope", () => {
  let db: Database.Database;
  let ledger: BudgetLedger;

  beforeEach(() => {
    db = migratedDb();
    ledger = new BudgetLedger(db, "p1");
  });

  function rec(sessionId: string, costUsd: number): void {
    ledger.record({
      caller: "test",
      provider: "anthropic",
      model: "anthropic/claude-haiku-4-5",
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd,
      latencyMs: 10,
      status: "ok",
      sessionId,
    });
  }

  it("aggregate filters by sessionId", () => {
    rec("sess-A", 0.01);
    rec("sess-A", 0.02);
    rec("sess-B", 0.05);
    expect(ledger.aggregate({ sessionId: "sess-A" }).totalUsd).toBeCloseTo(0.03, 8);
    expect(ledger.aggregate({ sessionId: "sess-B" }).totalUsd).toBeCloseTo(0.05, 8);
  });

  it("guard throws when session cap exceeded", () => {
    rec("sess-A", 0.04);
    expect(() =>
      ledger.guard({ sessionId: "sess-A" }, 0.02, { capUsdPerSession: 0.05 }),
    ).toThrow(LlmBudgetExceededError);
  });

  it("guard does not throw when below session cap", () => {
    rec("sess-A", 0.01);
    expect(() =>
      ledger.guard({ sessionId: "sess-A" }, 0.01, { capUsdPerSession: 0.05 }),
    ).not.toThrow();
  });

  it("isSessionSoftCapped returns true at default 50%", () => {
    rec("sess-A", 0.05);
    expect(ledger.isSessionSoftCapped({ sessionId: "sess-A" }, { capUsdPerSession: 0.10 })).toBe(true);
  });

  it("isSessionSoftCapped respects custom softCapFraction", () => {
    rec("sess-A", 0.05);
    // 50% of cap reached but threshold is 80% → not soft-capped yet
    expect(
      ledger.isSessionSoftCapped(
        { sessionId: "sess-A" },
        { capUsdPerSession: 0.10, softCapFraction: 0.8 },
      ),
    ).toBe(false);
    // crank spend past 80%
    rec("sess-A", 0.04);
    expect(
      ledger.isSessionSoftCapped(
        { sessionId: "sess-A" },
        { capUsdPerSession: 0.10, softCapFraction: 0.8 },
      ),
    ).toBe(true);
  });

  it("isSessionSoftCapped returns false when no sessionId", () => {
    expect(ledger.isSessionSoftCapped({}, { capUsdPerSession: 0.10 })).toBe(false);
  });
});

describe("budgetCapsFromEnv", () => {
  it("reads MCP_GRAPH_SESSION_BUDGET_USD + soft fraction", () => {
    const caps = budgetCapsFromEnv({
      MCP_GRAPH_SESSION_BUDGET_USD: "0.25",
      MCP_GRAPH_SESSION_SOFT_FRACTION: "0.7",
    });
    expect(caps.capUsdPerSession).toBeCloseTo(0.25);
    expect(caps.softCapFraction).toBeCloseTo(0.7);
  });

  it("ignores non-numeric values", () => {
    const caps = budgetCapsFromEnv({ MCP_GRAPH_SESSION_BUDGET_USD: "notanumber" });
    expect(caps.capUsdPerSession).toBeUndefined();
  });

  it("ignores soft fraction outside (0,1]", () => {
    const caps = budgetCapsFromEnv({ MCP_GRAPH_SESSION_SOFT_FRACTION: "1.5" });
    expect(caps.softCapFraction).toBeUndefined();
  });
});

describe("LlmGateway — soft-cap auto-fallback", () => {
  let db: Database.Database;
  let ledger: BudgetLedger;
  let primary: FakeAdapter;
  let cheaper: FakeAdapter;
  let gateway: LlmGateway;

  beforeEach(() => {
    db = migratedDb();
    ledger = new BudgetLedger(db, "p1");
    primary = new FakeAdapter("anthropic");
    cheaper = new FakeAdapter("openai");
    gateway = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map([
        ["anthropic", primary],
        ["openai", cheaper],
      ]),
      failoverChain: [
        { provider: "openai", model: "openai/gpt-4o-mini" },
      ],
    });
  });

  it("under soft-cap, complete() routes to primary", async () => {
    await gateway.complete(
      { model: "anthropic/claude-opus-4-7", messages: [{ role: "user", content: "hi" }] },
      { caller: "test", sessionId: "sess-A" },
      { caps: { capUsdPerSession: 1.0 } },
    );
    expect(primary.calls).toBe(1);
    expect(cheaper.calls).toBe(0);
  });

  it("over soft-cap, complete() skips primary and routes to failover entry", async () => {
    // Pre-load session spend past 50% of $1.00 cap.
    ledger.record({
      caller: "warmup",
      provider: "anthropic",
      model: "anthropic/claude-opus-4-7",
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0.6,
      latencyMs: 10,
      status: "ok",
      sessionId: "sess-A",
    });

    await gateway.complete(
      { model: "anthropic/claude-opus-4-7", messages: [{ role: "user", content: "hi" }] },
      { caller: "test", sessionId: "sess-A" },
      { caps: { capUsdPerSession: 1.0 } },
    );
    // Primary not called; cheaper failover used.
    expect(primary.calls).toBe(0);
    expect(cheaper.calls).toBe(1);
  });
});
