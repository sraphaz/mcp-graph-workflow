/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 11 — Prompt Cache Tracking & Cost Attribution
 * Tests for: cacheCreationInputTokens field, separate write rate in calcCost,
 * and node_id attribution in the ledger.
 */

import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { AnthropicAdapter } from "../core/llm/adapters/anthropic.js";
import { calcCost } from "../core/llm/pricing.js";
import { BudgetLedger } from "../core/llm/budget.js";
import { runMigrations } from "../core/store/migrations.js";
import type { ModelSpec } from "../core/llm/types.js";

// ─── AnthropicAdapter: cache_creation_input_tokens ────────────────────────────

function mockFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

describe("AnthropicAdapter — cache token tracking (EPIC 11)", () => {
  it("maps cache_creation_input_tokens to usage.cacheCreationInputTokens", async () => {
    const responseBody = {
      id: "msg_cache1",
      type: "message",
      role: "assistant",
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: "cached" }],
      usage: {
        input_tokens: 1000,
        output_tokens: 50,
        cache_creation_input_tokens: 900,
        cache_read_input_tokens: 0,
      },
    };
    const adapter = new AnthropicAdapter({
      apiKey: "k",
      fetchImpl: mockFetch(200, responseBody),
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    const res = await adapter.generate({
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.usage.cacheCreationInputTokens).toBe(900);
    expect(res.usage.cachedInputTokens).toBe(0);
    expect(res.usage.inputTokens).toBe(1000);
  });

  it("maps cache_read_input_tokens to usage.cachedInputTokens", async () => {
    const responseBody = {
      id: "msg_cache2",
      type: "message",
      role: "assistant",
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: "from cache" }],
      usage: {
        input_tokens: 1000,
        output_tokens: 30,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 900,
      },
    };
    const adapter = new AnthropicAdapter({
      apiKey: "k",
      fetchImpl: mockFetch(200, responseBody),
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    const res = await adapter.generate({
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi again" }],
    });
    expect(res.usage.cachedInputTokens).toBe(900);
    expect(res.usage.cacheCreationInputTokens).toBe(0);
  });
});

// ─── calcCost: cache write rate ────────────────────────────────────────────────

describe("calcCost — cache write rate (EPIC 11)", () => {
  const spec: ModelSpec = {
    id: "anthropic/claude-haiku-4-5",
    provider: "anthropic",
    tier: "cheap",
    contextWindow: 200_000,
    pricing: {
      inputPerMtok: 1.0,
      outputPerMtok: 5.0,
      cachedInputPerMtok: 0.1,        // cache read: 10% of input
      cacheCreationInputPerMtok: 0.25, // cache write: 25% of input
    },
  };

  it("applies cacheCreationInputPerMtok to cache write tokens", () => {
    const usd = calcCost(
      {
        inputTokens: 1000,
        outputTokens: 100,
        cacheCreationInputTokens: 800,
        cachedInputTokens: 0,
      },
      spec,
    );
    // plain_input = 1000 - 800 - 0 = 200 → 200/1e6 * 1.0 = 0.0002
    // cache_write = 800/1e6 * 0.25 = 0.0002
    // cache_read  = 0
    // output      = 100/1e6 * 5.0 = 0.0005
    // total = 0.0009
    expect(usd).toBeCloseTo(0.0009, 8);
  });

  it("applies both cache read and write when both are non-zero", () => {
    const usd = calcCost(
      {
        inputTokens: 1000,
        outputTokens: 100,
        cacheCreationInputTokens: 400,
        cachedInputTokens: 500,
      },
      spec,
    );
    // plain_input = 1000 - 400 - 500 = 100 → 100/1e6 * 1.0 = 0.0001
    // cache_write = 400/1e6 * 0.25 = 0.0001
    // cache_read  = 500/1e6 * 0.1  = 0.00005
    // output      = 100/1e6 * 5.0  = 0.0005
    // total = 0.00075
    expect(usd).toBeCloseTo(0.00075, 8);
  });

  it("falls back to inputPerMtok for cache write when cacheCreationInputPerMtok not set", () => {
    const noWriteSpec: ModelSpec = {
      ...spec,
      pricing: { inputPerMtok: 1.0, outputPerMtok: 5.0 },
    };
    const usd = calcCost(
      { inputTokens: 1000, outputTokens: 0, cacheCreationInputTokens: 500 },
      noWriteSpec,
    );
    // No cache rates → all tokens at inputPerMtok = 1.0
    // 1000/1e6 * 1.0 = 0.001 (no discount)
    expect(usd).toBeCloseTo(0.001, 8);
  });
});

// ─── BudgetLedger — node_id attribution ───────────────────────────────────────

describe("BudgetLedger — node_id cost attribution (EPIC 11)", () => {
  function makeDb(): Database.Database {
    const db = new Database(":memory:");
    runMigrations(db);
    return db;
  }

  it("record() accepts nodeId and stores it in node_id column", () => {
    const db = makeDb();
    const ledger = new BudgetLedger(db, "proj-1");
    ledger.record({
      caller: "test-caller",
      provider: "anthropic",
      model: "anthropic/claude-haiku-4-5",
      usage: {
        inputTokens: 100,
        outputTokens: 10,
        cachedInputTokens: 80,
        cacheCreationInputTokens: 0,
      },
      costUsd: 0.0001,
      latencyMs: 50,
      status: "ok",
      nodeId: "node_abc123",
    });

    const row = db.prepare("SELECT node_id, cached_input_tokens, cache_creation_tokens FROM llm_call_ledger LIMIT 1").get() as {
      node_id: string | null;
      cached_input_tokens: number | null;
      cache_creation_tokens: number | null;
    };
    expect(row.node_id).toBe("node_abc123");
    expect(row.cached_input_tokens).toBe(80);
    expect(row.cache_creation_tokens).toBe(0);
  });

  it("aggregate() returns totalUsd and callCount filtered by project", () => {
    const db = makeDb();
    const ledger = new BudgetLedger(db, "proj-x");
    const usage = { inputTokens: 100, outputTokens: 10 };
    ledger.record({ caller: "a", provider: "anthropic", model: "x", usage, costUsd: 0.01, latencyMs: 1, status: "ok" });
    ledger.record({ caller: "b", provider: "openai", model: "y", usage, costUsd: 0.02, latencyMs: 2, status: "ok" });
    const agg = ledger.aggregate({});
    expect(agg.totalUsd).toBeCloseTo(0.03, 8);
    expect(agg.callCount).toBe(2);
  });
});
