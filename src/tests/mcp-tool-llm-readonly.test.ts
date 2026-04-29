/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { buildLlmHandler } from "../mcp/tools/llm.js";
import type { LlmGateway } from "../core/llm/gateway.js";
import type { ModelSpec } from "../core/llm/types.js";
import { DEFAULT_MODEL_SEED } from "../core/llm/registry.js";

function fakeGateway(opts: {
  listModels?: (o?: { allowExpensive?: boolean; tier?: ModelSpec["tier"] }) => ModelSpec[];
  budgetStatus?: (s: { cellId?: string; runId?: string }) => {
    totalUsd: number;
    callCount: number;
    byProvider: Record<string, number>;
  };
}): LlmGateway {
  return {
    generate: async () => ({ kind: "final", model: "x", content: "", usage: { inputTokens: 0, outputTokens: 0 } }),
    listModels: opts.listModels ?? (() => [...DEFAULT_MODEL_SEED]),
    budgetStatus: opts.budgetStatus ?? (() => ({ totalUsd: 0, callCount: 0, byProvider: {} })),
  } as unknown as LlmGateway;
}

describe("MCP tool `llm` — read-only actions (D.1c)", () => {
  it("list_models default returns models with no expensive tier", async () => {
    const gateway = fakeGateway({
      listModels: (o) =>
        DEFAULT_MODEL_SEED.filter((m) => (o?.allowExpensive ?? false) || m.tier !== "expensive"),
    });
    const handler = buildLlmHandler({ gateway });
    const res = await handler({ action: "list_models" });
    expect(res.isError).toBeFalsy();
    const sc = (res as { structuredContent?: { models: ModelSpec[] } }).structuredContent;
    expect(sc?.models).toBeDefined();
    expect(sc!.models.length).toBeGreaterThan(0);
    expect(sc!.models.every((m) => m.tier !== "expensive")).toBe(true);
  });

  it("list_models with allowExpensive:true includes expensive tier", async () => {
    const gateway = fakeGateway({
      listModels: (o) =>
        DEFAULT_MODEL_SEED.filter((m) => (o?.allowExpensive ?? false) || m.tier !== "expensive"),
    });
    const handler = buildLlmHandler({ gateway });
    const res = await handler({ action: "list_models", allowExpensive: true });
    const sc = (res as { structuredContent?: { models: ModelSpec[] } }).structuredContent;
    expect(sc!.models.some((m) => m.tier === "expensive")).toBe(true);
  });

  it("list_models with tier='cheap' returns only cheap models", async () => {
    const gateway = fakeGateway({
      listModels: (o) => DEFAULT_MODEL_SEED.filter((m) => (o?.tier ? m.tier === o.tier : true)),
    });
    const handler = buildLlmHandler({ gateway });
    const res = await handler({ action: "list_models", tier: "cheap", allowExpensive: true });
    const sc = (res as { structuredContent?: { models: ModelSpec[] } }).structuredContent;
    expect(sc!.models.every((m) => m.tier === "cheap")).toBe(true);
  });

  it("budget_status with cellId returns structuredContent.aggregate", async () => {
    const gateway = fakeGateway({
      budgetStatus: (s) => {
        expect(s.cellId).toBe("node_X");
        return { totalUsd: 0.42, callCount: 3, byProvider: { anthropic: 0.42 } };
      },
    });
    const handler = buildLlmHandler({ gateway });
    const res = await handler({ action: "budget_status", cellId: "node_X" });
    expect(res.isError).toBeFalsy();
    const sc = (res as { structuredContent?: { aggregate: { totalUsd: number; callCount: number } } })
      .structuredContent;
    expect(sc?.aggregate.totalUsd).toBeCloseTo(0.42, 6);
    expect(sc?.aggregate.callCount).toBe(3);
  });

  it("budget_status without cellId or runId still works (returns empty aggregate)", async () => {
    const handler = buildLlmHandler({ gateway: fakeGateway({}) });
    const res = await handler({ action: "budget_status" });
    expect(res.isError).toBeFalsy();
  });

  it("proxy_status returns structuredContent.available=false and mentions 'Fase E'", async () => {
    const handler = buildLlmHandler({ gateway: fakeGateway({}) });
    const res = await handler({ action: "proxy_status" });
    expect(res.isError).toBeFalsy();
    const sc = (res as { structuredContent?: { available: boolean; reason: string } }).structuredContent;
    expect(sc?.available).toBe(false);
    expect(sc?.reason).toContain("Fase E");
  });

  it("read-only handlers do not require gateway for proxy_status (placeholder)", async () => {
    const handler = buildLlmHandler({});
    const res = await handler({ action: "proxy_status" });
    expect(res.isError).toBeFalsy();
  });

  it("list_models without gateway returns error", async () => {
    const handler = buildLlmHandler({});
    const res = await handler({ action: "list_models" });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text.toLowerCase()).toContain("gateway");
  });
});
