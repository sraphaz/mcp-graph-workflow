/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { buildLlmHandler, llmInputSchema } from "../mcp/tools/llm.js";
import { LlmModelUnknown, LlmBudgetExceededError } from "../core/llm/errors.js";
import type { LlmGateway } from "../core/llm/gateway.js";
import type { CallContext, LlmRequest, LlmResponse, ModelSpec } from "../core/llm/types.js";

function fakeGateway(opts: {
  generate?: (req: LlmRequest, ctx: CallContext) => Promise<LlmResponse>;
  models?: () => ModelSpec[];
}): LlmGateway {
  return {
    generate: opts.generate ?? (async () => ({ kind: "final", model: "x", content: "", usage: { inputTokens: 0, outputTokens: 0 } })),
    listModels: opts.models ?? (() => []),
    budgetStatus: () => ({ totalUsd: 0, callCount: 0, byProvider: {} }),
  } as unknown as LlmGateway;
}

describe("MCP tool `llm` — generate action (D.1b)", () => {
  it("returns success response with content from LlmGateway.generate", async () => {
    let captured: { req?: LlmRequest; ctx?: CallContext } = {};
    const gateway = fakeGateway({
      generate: async (req, ctx) => {
        captured = { req, ctx };
        return {
          kind: "final",
          model: req.model,
          content: "hello from gateway",
          usage: { inputTokens: 10, outputTokens: 4 },
        };
      },
    });
    const handler = buildLlmHandler({ gateway });
    const res = await handler({
      action: "generate",
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
      caller: "test-runner",
      cellId: "node_X",
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0]?.text).toContain("hello from gateway");
    expect(captured.req?.model).toBe("anthropic/claude-haiku-4-5");
    expect(captured.ctx?.caller).toBe("test-runner");
    expect(captured.ctx?.cellId).toBe("node_X");
  });

  it("structuredContent includes model and usage", async () => {
    const gateway = fakeGateway({
      generate: async (req) => ({
        kind: "final",
        model: req.model,
        content: "ok",
        usage: { inputTokens: 7, outputTokens: 3 },
      }),
    });
    const handler = buildLlmHandler({ gateway });
    const res = await handler({
      action: "generate",
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
    });
    const sc = (res as { structuredContent?: { model: string; usage: unknown } }).structuredContent;
    expect(sc).toBeDefined();
    expect(sc!.model).toBe("anthropic/claude-haiku-4-5");
    expect(sc!.usage).toEqual({ inputTokens: 7, outputTokens: 3 });
  });

  it("LlmModelUnknown thrown by gateway → isError:true, text contains 'LlmModelUnknown'", async () => {
    const gateway = fakeGateway({
      generate: async () => {
        throw new LlmModelUnknown("foo/bar");
      },
    });
    const handler = buildLlmHandler({ gateway });
    const res = await handler({
      action: "generate",
      model: "foo/bar",
      messages: [{ role: "user", content: "h" }],
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("LlmModelUnknown");
  });

  it("LlmBudgetExceededError → isError:true, text mentions 'budget'", async () => {
    const gateway = fakeGateway({
      generate: async () => {
        throw new LlmBudgetExceededError({ scope: "cell", scopeId: "X", currentUsd: 1.5, capUsd: 1.0 });
      },
    });
    const handler = buildLlmHandler({ gateway });
    const res = await handler({
      action: "generate",
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "h" }],
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text.toLowerCase()).toContain("budget");
  });

  it("missing model → handler returns isError before gateway.generate runs", async () => {
    let called = false;
    const gateway = fakeGateway({
      generate: async () => {
        called = true;
        throw new Error("should not reach");
      },
    });
    const handler = buildLlmHandler({ gateway });
    const res = await handler({
      action: "generate",
      messages: [{ role: "user", content: "h" }],
    });
    expect(res.isError).toBe(true);
    expect(called).toBe(false);
    expect(res.content[0]?.text.toLowerCase()).toContain("model");
  });

  it("inputSchema rejects payload without action field", () => {
    const r = llmInputSchema.safeParse({ model: "x/y" });
    expect(r.success).toBe(false);
  });

  it("missing gateway dep → isError 'gateway not configured'", async () => {
    const handler = buildLlmHandler({});
    const res = await handler({
      action: "generate",
      model: "x/y",
      messages: [{ role: "user", content: "h" }],
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text.toLowerCase()).toContain("gateway");
  });

  it("default caller is 'mcp-tool' when not provided", async () => {
    let captured: CallContext | null = null;
    const gateway = fakeGateway({
      generate: async (_req, ctx) => {
        captured = ctx;
        return { kind: "final", model: _req.model, content: "ok", usage: { inputTokens: 0, outputTokens: 0 } };
      },
    });
    const handler = buildLlmHandler({ gateway });
    await handler({
      action: "generate",
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "h" }],
    });
    expect(captured!.caller).toBe("mcp-tool");
  });
});
