/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { LlmGateway } from "../core/llm/gateway.js";
import { ModelRegistry, DEFAULT_MODEL_SEED } from "../core/llm/registry.js";
import type { BudgetLedger, BudgetScopeRef, LedgerRow } from "../core/llm/budget.js";
import type { ProviderAdapter } from "../core/llm/adapters/base.js";
import type { LlmRequest, LlmResponse, ModelSpec, ProviderName } from "../core/llm/types.js";

class FakeAdapter implements ProviderAdapter {
  constructor(public readonly name: ProviderName) {}
  async generate(req: LlmRequest): Promise<LlmResponse> {
    return { kind: "final", model: req.model, content: "atomic-response", usage: { inputTokens: 5, outputTokens: 3 } };
  }
  models(): ModelSpec[] { return DEFAULT_MODEL_SEED.filter((m) => m.provider === this.name); }
}

function makeGateway(): LlmGateway {
  const rows: LedgerRow[] = [];
  const ledger = {
    guard() { /* no-op */ },
    record(row: LedgerRow) { rows.push(row); },
    aggregate(_scope: BudgetScopeRef) { return { totalUsd: 0, callCount: rows.length, byProvider: {} }; },
    isSessionSoftCapped() { return false; },

  } as unknown as BudgetLedger;
  return new LlmGateway({
    registry: new ModelRegistry(DEFAULT_MODEL_SEED),
    budget: ledger,
    adapters: new Map([["anthropic", new FakeAdapter("anthropic")]]),
  });
}

describe("LlmGateway.complete() — backward compatibility (zero-breaking)", () => {
  it("complete(req, ctx) with no opts compiles and returns the full response atomically", async () => {
    const gw = makeGateway();
    const res = await gw.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hello" }] },
      { caller: "legacy-caller" },
    );
    expect(res.content).toBe("atomic-response");
    expect(res.kind).toBe("final");
    expect(typeof res.content).toBe("string");
  });

  it("complete(req, ctx, {}) with empty opts object also works", async () => {
    const gw = makeGateway();
    const res = await gw.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hello" }] },
      { caller: "legacy-caller" },
      {},
    );
    expect(res.content).toBe("atomic-response");
  });

  it("complete(req, ctx, { caps }) with caps but no streamDelta does not throw", async () => {
    const gw = makeGateway();
    const res = await gw.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hello" }] },
      { caller: "legacy-caller" },
      { caps: {} },
    );
    expect(res.content).toBe("atomic-response");
  });

  it("opts is structurally optional — the TypeScript param has a default value of {}", () => {
    // This test exists to document the TS contract:
    // LlmGateway.complete has signature (req, ctx, opts = {})
    // so callers can omit opts entirely.
    const gw = makeGateway();
    // If this line compiles without error, the TS types are correct.
    const promise = gw.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      { caller: "test" },
    );
    expect(promise).toBeInstanceOf(Promise);
  });
});
