/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  LlmAuthError,
  LlmRateLimitError,
  LlmBudgetExceededError,
  LlmTransportError,
  LlmContextWindowError,
  LlmModelUnknown,
} from "../core/llm/errors.js";
import {
  LlmRequestSchema,
  LlmResponseSchema,
  ModelSpecSchema,
  type LlmRequest,
  type LlmResponse,
  type LlmUsage,
  type ModelSpec,
  type ModelTier,
  type CallContext,
  type ChatMessage,
} from "../core/llm/types.js";
import { McpGraphError } from "../core/utils/errors.js";

describe("core/llm/errors — typed error hierarchy", () => {
  it("LlmAuthError extends McpGraphError with correct name and provider", () => {
    const err = new LlmAuthError("anthropic", "401 Unauthorized");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(McpGraphError);
    expect(err.name).toBe("LlmAuthError");
    expect(err.provider).toBe("anthropic");
    expect(err.message).toContain("anthropic");
    expect(err.message).toContain("401 Unauthorized");
  });

  it("LlmRateLimitError carries retryAfterMs", () => {
    const err = new LlmRateLimitError("openrouter", 5000);
    expect(err.name).toBe("LlmRateLimitError");
    expect(err.provider).toBe("openrouter");
    expect(err.retryAfterMs).toBe(5000);
  });

  it("LlmBudgetExceededError carries scope and current/cap", () => {
    const err = new LlmBudgetExceededError({
      scope: "cell",
      scopeId: "node_abc",
      currentUsd: 1.2,
      capUsd: 1.0,
    });
    expect(err.name).toBe("LlmBudgetExceededError");
    expect(err.details.scope).toBe("cell");
    expect(err.details.scopeId).toBe("node_abc");
    expect(err.details.currentUsd).toBe(1.2);
    expect(err.details.capUsd).toBe(1.0);
  });

  it("LlmTransportError wraps cause and provider", () => {
    const err = new LlmTransportError("anthropic", "ECONNRESET");
    expect(err.name).toBe("LlmTransportError");
    expect(err.message).toContain("ECONNRESET");
  });

  it("LlmContextWindowError carries token counts", () => {
    const err = new LlmContextWindowError("anthropic/claude-haiku-4-5", 220_000, 200_000);
    expect(err.name).toBe("LlmContextWindowError");
    expect(err.requestedTokens).toBe(220_000);
    expect(err.maxTokens).toBe(200_000);
  });

  it("LlmModelUnknown carries the unknown model id", () => {
    const err = new LlmModelUnknown("foo/bar-9000");
    expect(err.name).toBe("LlmModelUnknown");
    expect(err.modelId).toBe("foo/bar-9000");
    expect(err.message).toContain("foo/bar-9000");
  });
});

describe("core/llm/types — Zod schemas", () => {
  it("LlmRequestSchema parses a minimal request", () => {
    const parsed = LlmRequestSchema.parse({
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hello" }],
    });
    const typed: LlmRequest = parsed;
    expect(typed.model).toBe("anthropic/claude-haiku-4-5");
    expect(typed.messages).toHaveLength(1);
    expect(typed.stream).toBeUndefined();
  });

  it("LlmRequestSchema rejects stream:true (v1 non-streaming only)", () => {
    const result = LlmRequestSchema.safeParse({
      model: "x/y",
      messages: [{ role: "user", content: "h" }],
      stream: true,
    });
    expect(result.success).toBe(false);
  });

  it("LlmRequestSchema accepts providerExtras passthrough", () => {
    const parsed = LlmRequestSchema.parse({
      model: "x/y",
      messages: [{ role: "user", content: "h" }],
      providerExtras: { logit_bias: { 50256: -100 } },
    });
    expect(parsed.providerExtras).toBeDefined();
  });

  it("LlmResponseSchema validates kind discriminant", () => {
    const parsed = LlmResponseSchema.parse({
      model: "x/y",
      content: "ok",
      usage: { inputTokens: 1, outputTokens: 2 },
    });
    const typed: LlmResponse = parsed;
    expect(typed.content).toBe("ok");
    expect(typed.usage.inputTokens).toBe(1);
  });

  it("ModelSpecSchema requires tier to be cheap/mid/expensive", () => {
    const ok = ModelSpecSchema.safeParse({
      id: "anthropic/claude-haiku-4-5",
      provider: "anthropic",
      tier: "cheap",
      contextWindow: 200_000,
      pricing: { inputPerMtok: 1.0, outputPerMtok: 5.0 },
    });
    expect(ok.success).toBe(true);

    const bad = ModelSpecSchema.safeParse({
      id: "x/y",
      provider: "anthropic",
      tier: "ludicrous",
      contextWindow: 100,
      pricing: { inputPerMtok: 1, outputPerMtok: 1 },
    });
    expect(bad.success).toBe(false);
  });

  it("type aliases are exported and assignable", () => {
    const tier: ModelTier = "cheap";
    const ctx: CallContext = { caller: "browser-harness" };
    const msg: ChatMessage = { role: "user", content: "hi" };
    const usage: LlmUsage = { inputTokens: 10, outputTokens: 5 };
    const spec: ModelSpec = {
      id: "x/y",
      provider: "anthropic",
      tier: "mid",
      contextWindow: 100_000,
      pricing: { inputPerMtok: 2, outputPerMtok: 10 },
    };
    expect(tier).toBe("cheap");
    expect(ctx.caller).toBe("browser-harness");
    expect(msg.role).toBe("user");
    expect(usage.inputTokens).toBe(10);
    expect(spec.tier).toBe("mid");
  });
});
