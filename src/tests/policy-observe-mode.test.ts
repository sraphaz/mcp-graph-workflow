/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-policy-engine-context-routing — Task 1.3: Modo observe
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { LlmGateway } from "../core/llm/gateway.js";
import { BudgetLedger } from "../core/llm/budget.js";
import { ModelRegistry, DEFAULT_MODEL_SEED } from "../core/llm/registry.js";
import type { ProviderAdapter } from "../core/llm/adapters/base.js";
import type { LlmRequest, LlmResponse, ModelSpec, ProviderName } from "../core/llm/types.js";
import {
  PolicyObserverStore,
  type PolicyObservation,
  type PolicyObserver,
} from "../core/llm/policy-observer.js";
import type { PolicyConfig } from "../core/llm/policy-engine.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      content: "fake",
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  }
  models(): ModelSpec[] {
    return DEFAULT_MODEL_SEED.filter((m) => m.provider === this.name);
  }
}

class CollectingObserver implements PolicyObserver {
  readonly observations: PolicyObservation[] = [];
  record(obs: PolicyObservation): void {
    this.observations.push(obs);
  }
}

const BASE_POLICY: PolicyConfig = {
  mode: "observe",
  preferLocalWhenBudgetBelow: 0.05,
  failoverChain: ["openai", "anthropic"],
};

const REQ: LlmRequest = {
  model: "anthropic/claude-haiku-4-5",
  messages: [{ role: "user", content: "hello" }],
};

const CTX = { caller: "test", cellId: "cell-1" };

// ---------------------------------------------------------------------------
// AC1: mode=observe — policy runs + log written + static chain used
// ---------------------------------------------------------------------------

describe("gateway observe mode — AC1: policy runs, static chain unchanged", () => {
  let gateway: LlmGateway;
  let anthropicAdapter: FakeAdapter;
  let collector: CollectingObserver;

  beforeEach(() => {
    const db = migratedDb();
    const ledger = new BudgetLedger(db, "p1");
    anthropicAdapter = new FakeAdapter("anthropic");
    collector = new CollectingObserver();
    gateway = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map([["anthropic", anthropicAdapter]]),
      policyConfig: BASE_POLICY,
      policyObserver: collector,
    });
  });

  it("complete() still calls the primary adapter (static chain unchanged)", async () => {
    const res = await gateway.complete(REQ, CTX);
    expect(res.content).toBe("fake");
    expect(anthropicAdapter.calls).toBe(1);
  });

  it("observer receives exactly one observation per complete() call", async () => {
    await gateway.complete(REQ, CTX);
    expect(collector.observations).toHaveLength(1);
  });

  it("observation is recorded even when decision diverges from actual chain", async () => {
    await gateway.complete(REQ, CTX);
    const obs = collector.observations[0];
    expect(obs).toBeDefined();
    expect(typeof obs.divergence).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// AC2: observation shape — timestamp, signalsSnapshot, decision, actualUsed
// ---------------------------------------------------------------------------

describe("gateway observe mode — AC2: observation shape", () => {
  let collector: CollectingObserver;

  beforeEach(async () => {
    const db = migratedDb();
    const ledger = new BudgetLedger(db, "p1");
    collector = new CollectingObserver();
    const gateway = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map([["anthropic", new FakeAdapter("anthropic")]]),
      policyConfig: BASE_POLICY,
      policyObserver: collector,
    });
    await gateway.complete(REQ, CTX);
  });

  it("has id (non-empty string)", () => {
    expect(collector.observations[0].id).toBeTruthy();
    expect(typeof collector.observations[0].id).toBe("string");
  });

  it("has timestamp (ISO 8601)", () => {
    const ts = collector.observations[0].timestamp;
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it("has signalsSnapshot with required fields", () => {
    const snap = collector.observations[0].signalsSnapshot;
    expect(typeof snap.promptTokensEstimate).toBe("number");
    expect(typeof snap.budgetRemainingPct).toBe("number");
    expect(snap.latencyP95ByProvider).toBeDefined();
    expect(snap.backendHealth).toBeDefined();
  });

  it("has decision with chain, reasonsByProvider, appliedRule", () => {
    const d = collector.observations[0].decision;
    expect(Array.isArray(d.chain)).toBe(true);
    expect(typeof d.appliedRule).toBe("string");
    expect(d.reasonsByProvider).toBeDefined();
  });

  it("has actualUsed (list of providers tried)", () => {
    const actual = collector.observations[0].actualUsed;
    expect(Array.isArray(actual)).toBe(true);
    expect(actual.length).toBeGreaterThan(0);
  });

  it("has divergence boolean", () => {
    expect(typeof collector.observations[0].divergence).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// AC3: mode=off — policy does NOT run (zero overhead)
// ---------------------------------------------------------------------------

describe("gateway observe mode — AC3: mode=off skips policy", () => {
  it("does not call observer when mode=off", async () => {
    const db = migratedDb();
    const ledger = new BudgetLedger(db, "p1");
    const collector = new CollectingObserver();
    const gateway = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map([["anthropic", new FakeAdapter("anthropic")]]),
      policyConfig: { ...BASE_POLICY, mode: "off" },
      policyObserver: collector,
    });
    await gateway.complete(REQ, CTX);
    expect(collector.observations).toHaveLength(0);
  });

  it("does not call observer when policyConfig is absent", async () => {
    const db = migratedDb();
    const ledger = new BudgetLedger(db, "p1");
    const collector = new CollectingObserver();
    const gateway = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map([["anthropic", new FakeAdapter("anthropic")]]),
      policyObserver: collector,
    });
    await gateway.complete(REQ, CTX);
    expect(collector.observations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PolicyObserverStore — SQLite persistence
// ---------------------------------------------------------------------------

describe("PolicyObserverStore — SQLite persistence", () => {
  let db: Database.Database;
  let store: PolicyObserverStore;

  beforeEach(() => {
    db = migratedDb();
    store = new PolicyObserverStore(db, "p1");
  });

  const SAMPLE_OBS: PolicyObservation = {
    id: "obs-001",
    timestamp: new Date().toISOString(),
    signalsSnapshot: {
      promptTokensEstimate: 200,
      budgetRemainingPct: 0.75,
      latencyP95ByProvider: { openai: 300, anthropic: 450 },
      backendHealth: { openai: "online", anthropic: "online" },
    },
    decision: {
      chain: ["openai", "anthropic"],
      reasonsByProvider: { openai: ["default_chain"], anthropic: ["default_chain"] },
      appliedRule: "default_chain",
    },
    actualUsed: ["anthropic"],
    divergence: true,
  };

  it("record() stores observation in DB without throwing", () => {
    expect(() => store.record(SAMPLE_OBS)).not.toThrow();
  });

  it("recent() retrieves recorded observation with all fields", () => {
    store.record(SAMPLE_OBS);
    const rows = store.recent(5);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.id).toBe("obs-001");
    expect(row.timestamp).toBe(SAMPLE_OBS.timestamp);
    expect(row.signalsSnapshot.promptTokensEstimate).toBe(200);
    expect(row.decision.appliedRule).toBe("default_chain");
    expect(row.actualUsed).toEqual(["anthropic"]);
    expect(row.divergence).toBe(true);
  });

  it("recent(n) limits results", () => {
    for (let i = 0; i < 5; i++) {
      store.record({ ...SAMPLE_OBS, id: `obs-${i}` });
    }
    expect(store.recent(3)).toHaveLength(3);
  });
});
