/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { LlmGateway } from "../core/llm/gateway.js";
import { BudgetLedger } from "../core/llm/budget.js";
import { ModelRegistry, DEFAULT_MODEL_SEED } from "../core/llm/registry.js";
import {
  LlmBudgetExceededError,
  LlmModelUnknown,
} from "../core/llm/errors.js";
import type { ProviderAdapter } from "../core/llm/adapters/base.js";
import type { LlmRequest, LlmResponse, ModelSpec, ProviderName } from "../core/llm/types.js";

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
      content: "fake-response",
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  }
  models(): ModelSpec[] {
    return DEFAULT_MODEL_SEED.filter((m) => m.provider === this.name);
  }
}

describe("LlmGateway", () => {
  let db: Database.Database;
  let ledger: BudgetLedger;
  let anthropicAdapter: FakeAdapter;
  let openaiAdapter: FakeAdapter;
  let gateway: LlmGateway;

  beforeEach(() => {
    db = migratedDb();
    ledger = new BudgetLedger(db, "p1");
    anthropicAdapter = new FakeAdapter("anthropic");
    openaiAdapter = new FakeAdapter("openai");
    gateway = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map([
        ["anthropic", anthropicAdapter],
        ["openai", openaiAdapter],
      ]),
    });
  });

  it("generate() routes to the right adapter, computes cost, records ledger", async () => {
    const res = await gateway.generate(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      { caller: "browser-harness", cellId: "node_X" },
    );
    expect(res.content).toBe("fake-response");
    expect(anthropicAdapter.calls).toBe(1);
    expect(openaiAdapter.calls).toBe(0);

    const agg = ledger.aggregate({ cellId: "node_X" });
    expect(agg.callCount).toBe(1);
    // cost = 100/1e6 * 1.0 + 50/1e6 * 5.0 = 0.0001 + 0.00025 = 0.00035
    expect(agg.totalUsd).toBeCloseTo(0.00035, 8);
    expect(agg.byProvider.anthropic).toBeCloseTo(0.00035, 8);
  });

  it("budget guard fires BEFORE calling adapter when cap would be exceeded", async () => {
    ledger.record({
      caller: "external",
      provider: "anthropic",
      model: "anthropic/claude-haiku-4-5",
      usage: { inputTokens: 0, outputTokens: 0 },
      costUsd: 0.0009,
      latencyMs: 1,
      status: "ok",
      cellId: "node_X",
    });
    await expect(
      gateway.generate(
        { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "h" }] },
        { caller: "browser-harness", cellId: "node_X" },
        { capUsdPerCell: 0.001 },
      ),
    ).rejects.toBeInstanceOf(LlmBudgetExceededError);
    expect(anthropicAdapter.calls).toBe(0);
  });

  it("throws LlmModelUnknown when model id is not in registry", async () => {
    await expect(
      gateway.generate(
        { model: "unknown/foo", messages: [{ role: "user", content: "h" }] },
        { caller: "external" },
      ),
    ).rejects.toBeInstanceOf(LlmModelUnknown);
    expect(anthropicAdapter.calls).toBe(0);
  });

  it("listModels({allowExpensive:false}) returns only non-expensive models", () => {
    const cheap = gateway.listModels({ allowExpensive: false });
    expect(cheap.length).toBeGreaterThan(0);
    expect(cheap.every((m: ModelSpec) => m.tier !== "expensive")).toBe(true);
  });

  it("listModels({allowExpensive:true}) includes expensive tier", () => {
    const all = gateway.listModels({ allowExpensive: true });
    expect(all.some((m: ModelSpec) => m.tier === "expensive")).toBe(true);
  });

  it("policy: model with tier='expensive' is rejected when allowExpensive=false", async () => {
    const restricted = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map([["anthropic", anthropicAdapter]]),
      allowExpensive: false,
    });
    await expect(
      restricted.generate(
        { model: "anthropic/claude-sonnet-4-6", messages: [{ role: "user", content: "h" }] },
        { caller: "external" },
      ),
    ).rejects.toThrow();
    expect(anthropicAdapter.calls).toBe(0);
  });

  it("budgetStatus({cellId}) returns aggregate from ledger", () => {
    ledger.record({
      caller: "browser-harness",
      provider: "anthropic",
      model: "anthropic/claude-haiku-4-5",
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0.5,
      latencyMs: 1,
      status: "ok",
      cellId: "node_Y",
    });
    const status = gateway.budgetStatus({ cellId: "node_Y" });
    expect(status.totalUsd).toBeCloseTo(0.5, 6);
    expect(status.callCount).toBe(1);
  });

  it("records ledger with status='error' when adapter throws", async () => {
    const flakyAdapter: ProviderAdapter = {
      name: "anthropic",
      generate: async () => {
        const err = new Error("upstream") as Error & { status: number };
        err.status = 503;
        throw err;
      },
      models: () => [],
    };
    const errGateway = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map([["anthropic", flakyAdapter]]),
    });
    await expect(
      errGateway.generate(
        { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "h" }] },
        { caller: "browser-harness", cellId: "node_E" },
      ),
    ).rejects.toThrow();
    const agg = ledger.aggregate({ cellId: "node_E" });
    expect(agg.callCount).toBe(1);
    expect(agg.totalUsd).toBe(0);
  });
});
