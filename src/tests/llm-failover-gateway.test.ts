/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-16.2 — gateway failover integration
 */

import { describe, it, expect } from "vitest";
import { LlmGateway } from "../core/llm/gateway.js";
import { LlmCircuitBreaker } from "../core/llm/circuit-breaker-llm.js";
import { ModelRegistry, DEFAULT_MODEL_SEED } from "../core/llm/registry.js";
import type {
  BudgetAggregate,
  BudgetLedger,
  BudgetScopeRef,
  LedgerRow,
} from "../core/llm/budget.js";
import type { ProviderAdapter } from "../core/llm/adapters/base.js";
import type { LlmRequest, LlmResponse, ModelSpec, ProviderName } from "../core/llm/types.js";

function makeLedger(): { ledger: BudgetLedger; rows: LedgerRow[] } {
  const rows: LedgerRow[] = [];
  const ledger = {
    guard() { /* no-op */ },
    record(row: LedgerRow) { rows.push(row); },
    aggregate(_scope: BudgetScopeRef): BudgetAggregate {
      return { totalUsd: 0, callCount: rows.length, byProvider: {} };
    },
  } as unknown as BudgetLedger;
  return { ledger, rows };
}

class StaticAdapter implements ProviderAdapter {
  constructor(public readonly name: ProviderName, private readonly text = "ok") {}
  async generate(req: LlmRequest): Promise<LlmResponse> {
    return {
      kind: "final",
      model: req.model,
      content: this.text,
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  }
  models(): ModelSpec[] {
    return DEFAULT_MODEL_SEED.filter((m) => m.provider === this.name);
  }
}

class FailingAdapter implements ProviderAdapter {
  public callCount = 0;
  constructor(public readonly name: ProviderName, private readonly status = 429) {}
  async generate(_req: LlmRequest): Promise<LlmResponse> {
    this.callCount++;
    const err = new Error(`HTTP ${this.status}`);
    (err as unknown as { status: number }).status = this.status;
    throw err;
  }
  models(): ModelSpec[] {
    return DEFAULT_MODEL_SEED.filter((m) => m.provider === this.name);
  }
}

describe("LlmGateway.complete() — failover", () => {
  it("AC1: primary 429 → falls over to next chain entry", async () => {
    const { ledger, rows } = makeLedger();
    const gw = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map<ProviderName, ProviderAdapter>([
        ["anthropic", new FailingAdapter("anthropic", 429)],
        ["openai", new StaticAdapter("openai", "saved")],
      ]),
      circuitBreaker: new LlmCircuitBreaker(),
      failoverChain: [
        { provider: "anthropic", model: "anthropic/claude-haiku-4-5" },
        { provider: "openai", model: "openai/gpt-4o-mini" },
      ],
    });

    const res = await gw.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      { caller: "test" },
    );

    expect(res.content).toBe("saved");
    // Last successful row records provider_used = openai, fallback_count >= 1
    const success = rows.find((r) => r.status === "ok");
    expect(success?.providerUsed).toBe("openai");
    expect(success?.fallbackCount).toBeGreaterThanOrEqual(1);
  });

  it("AC2/AC3: ledger rows reflect each attempt's provider + fallback count", async () => {
    const { ledger, rows } = makeLedger();
    const gw = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map<ProviderName, ProviderAdapter>([
        ["anthropic", new FailingAdapter("anthropic", 503)],
        ["openai", new StaticAdapter("openai", "rescued")],
      ]),
      circuitBreaker: new LlmCircuitBreaker(),
      failoverChain: [
        { provider: "anthropic", model: "anthropic/claude-haiku-4-5" },
        { provider: "openai", model: "openai/gpt-4o-mini" },
      ],
    });

    await gw.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      { caller: "test" },
    );

    expect(rows.length).toBe(2);
    // First row: error from anthropic, fallback_count 0
    expect(rows[0].provider).toBe("anthropic");
    expect(rows[0].status).toBe("error");
    // Second row: success from openai, fallback_count 1
    expect(rows[1].provider).toBe("openai");
    expect(rows[1].status).toBe("ok");
    expect(rows[1].fallbackCount).toBe(1);
    expect(rows[1].providerUsed).toBe("openai");
  });

  it("AC1: when no chain configured, primary failure throws (no breaking change)", async () => {
    const { ledger } = makeLedger();
    const gw = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map([["anthropic", new FailingAdapter("anthropic", 500)]]),
    });

    await expect(
      gw.complete(
        { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "x" }] },
        { caller: "test" },
      ),
    ).rejects.toThrow();
  });

  it("AC4: failoverStatus() returns each provider's circuit state", async () => {
    const breaker = new LlmCircuitBreaker();
    const gw = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: makeLedger().ledger,
      adapters: new Map([
        ["anthropic", new StaticAdapter("anthropic")],
        ["openai", new StaticAdapter("openai")],
      ]),
      circuitBreaker: breaker,
      failoverChain: [
        { provider: "anthropic", model: "anthropic/claude-haiku-4-5" },
        { provider: "openai", model: "openai/gpt-4o-mini" },
      ],
    });

    breaker.recordFailure("anthropic", 429);
    breaker.recordFailure("anthropic", 429);
    breaker.recordFailure("anthropic", 429);

    const status = gw.failoverStatus();
    expect(status).toEqual([
      { provider: "anthropic", model: "anthropic/claude-haiku-4-5", state: "open" },
      { provider: "openai", model: "openai/gpt-4o-mini", state: "closed" },
    ]);
  });
});
