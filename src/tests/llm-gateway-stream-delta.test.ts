/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LlmGateway } from "../core/llm/gateway.js";
import { ModelRegistry, DEFAULT_MODEL_SEED } from "../core/llm/registry.js";
import type { BudgetAggregate, BudgetLedger, BudgetScopeRef, LedgerRow } from "../core/llm/budget.js";
import type { ProviderAdapter } from "../core/llm/adapters/base.js";
import type { LlmRequest, LlmResponse, ModelSpec, ProviderName } from "../core/llm/types.js";

function makeStubLedger(): { ledger: BudgetLedger; rows: LedgerRow[] } {
  const rows: LedgerRow[] = [];
  const ledger = {
    guard() { /* no-op pre-flight */ },
    record(row: LedgerRow) { rows.push(row); },
    aggregate(_scope: BudgetScopeRef): BudgetAggregate {
      return { totalUsd: 0, callCount: rows.length, byProvider: {} };
    },
  } as unknown as BudgetLedger;
  return { ledger, rows };
}

class FakeAdapter implements ProviderAdapter {
  constructor(
    public readonly name: ProviderName,
    public readonly responseContent = "hello world",
  ) {}
  async generate(req: LlmRequest): Promise<LlmResponse> {
    return {
      kind: "final",
      model: req.model,
      content: this.responseContent,
      usage: { inputTokens: 10, outputTokens: 5 },
    };
  }
  models(): ModelSpec[] {
    return DEFAULT_MODEL_SEED.filter((m) => m.provider === this.name);
  }
}

function makeGateway(responseContent = "chunk content"): LlmGateway {
  const { ledger } = makeStubLedger();
  return new LlmGateway({
    registry: new ModelRegistry(DEFAULT_MODEL_SEED),
    budget: ledger,
    adapters: new Map([["anthropic", new FakeAdapter("anthropic", responseContent)]]),
  });
}

describe("LlmGateway.complete() — streamDelta callback", () => {
  let gateway: LlmGateway;

  beforeEach(() => {
    gateway = makeGateway();
  });

  it("complete() without streamDelta returns the same response as generate()", async () => {
    const res = await gateway.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      { caller: "test" },
    );
    expect(res.content).toBe("chunk content");
    expect(res.kind).toBe("final");
  });

  it("complete() calls streamDelta with the response content", async () => {
    const chunks: Array<string | null> = [];
    await gateway.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      { caller: "test" },
      { streamDelta: (chunk: string | null) => { chunks.push(chunk); } },
    );
    expect(chunks).toContain("chunk content");
  });

  it("complete() calls streamDelta(null) as the final signal after content", async () => {
    const chunks: Array<string | null> = [];
    await gateway.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      { caller: "test" },
      { streamDelta: (chunk: string | null) => { chunks.push(chunk); } },
    );
    expect(chunks[chunks.length - 1]).toBeNull();
  });

  it("complete() calls streamDelta with non-null chunk before the null terminator", async () => {
    const chunks: Array<string | null> = [];
    await gateway.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      { caller: "test" },
      { streamDelta: (chunk: string | null) => { chunks.push(chunk); } },
    );
    const nullIdx = chunks.indexOf(null);
    expect(nullIdx).toBeGreaterThan(0);
    expect(chunks.slice(0, nullIdx).every((c) => typeof c === "string")).toBe(true);
  });

  it("complete() records a ledger entry for the call", async () => {
    const { ledger, rows } = makeStubLedger();
    const gw = new LlmGateway({
      registry: new ModelRegistry(DEFAULT_MODEL_SEED),
      budget: ledger,
      adapters: new Map([["anthropic", new FakeAdapter("anthropic")]]),
    });
    await gw.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      { caller: "test", cellId: "node_Z" },
      { streamDelta: vi.fn() },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("ok");
  });

  it("streamDelta is called exactly once with content and once with null (v1 single-chunk simulation)", async () => {
    const streamDelta = vi.fn();
    await gateway.complete(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      { caller: "test" },
      { streamDelta },
    );
    expect(streamDelta).toHaveBeenCalledTimes(2);
    expect(streamDelta).toHaveBeenNthCalledWith(1, "chunk content");
    expect(streamDelta).toHaveBeenNthCalledWith(2, null);
  });
});
