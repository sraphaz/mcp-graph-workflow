/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Estender ProviderAdapter com embed() opcional
 *
 * AC1: ProviderAdapter sem embed compila (método opcional)
 * AC2: EmbedRequest aceita input string
 * AC3: EmbedRequest aceita input string[] (batch)
 * AC4: EmbedResponse com vectors vazio → erro Zod (mínimo 1 vector)
 */

import { describe, it, expect } from "vitest";
import type { ProviderAdapter } from "../../core/llm/adapters/base.js";
import { EmbedRequestSchema, EmbedResponseSchema } from "../../core/llm/types.js";

// ---------------------------------------------------------------------------
// AC1: embed() is optional — compile-time check via conforming stub
// ---------------------------------------------------------------------------

describe("ProviderAdapter — AC1: embed() is optional", () => {
  it("should accept a ProviderAdapter without embed method", () => {
    const adapter: ProviderAdapter = {
      name: "anthropic",
      generate: async () => ({
        content: "hi",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, cachedInputTokens: 0, cacheCreationInputTokens: 0 },
        model: "claude-haiku-4-5-20251001",
        finishReason: "end_turn",
        id: "msg-1",
        provider: "anthropic",
        latencyMs: 0,
      }),
      models: () => [],
    };
    expect(adapter.embed).toBeUndefined();
  });

  it("should accept a ProviderAdapter with embed method", () => {
    const adapter: ProviderAdapter = {
      name: "openai",
      generate: async () => ({
        content: "hi",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, cachedInputTokens: 0, cacheCreationInputTokens: 0 },
        model: "gpt-4o",
        finishReason: "stop",
        id: "msg-2",
        provider: "openai",
        latencyMs: 0,
      }),
      models: () => [],
      embed: async () => ({ vectors: [[0.1, 0.2]], usage: { inputTokens: 5 } }),
    };
    expect(adapter.embed).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC2: EmbedRequest accepts input string
// ---------------------------------------------------------------------------

describe("EmbedRequestSchema — AC2: string input", () => {
  it("should parse input as string", () => {
    const result = EmbedRequestSchema.safeParse({ model: "text-embed-3", input: "hello world" });
    expect(result.success).toBe(true);
  });

  it("should use default model when omitted", () => {
    const result = EmbedRequestSchema.safeParse({ input: "hello" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3: EmbedRequest accepts string[] (batch)
// ---------------------------------------------------------------------------

describe("EmbedRequestSchema — AC3: string[] batch input", () => {
  it("should parse input as string array", () => {
    const result = EmbedRequestSchema.safeParse({ model: "text-embed-3", input: ["hello", "world"] });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("parse failed");
    expect(result.data.input).toEqual(["hello", "world"]);
  });
});

// ---------------------------------------------------------------------------
// AC4: EmbedResponse with empty vectors → Zod error
// ---------------------------------------------------------------------------

describe("EmbedResponseSchema — AC4: empty vectors rejected", () => {
  it("should reject empty vectors array", () => {
    const result = EmbedResponseSchema.safeParse({ vectors: [], usage: { inputTokens: 5 } });
    expect(result.success).toBe(false);
  });

  it("should accept non-empty vectors", () => {
    const result = EmbedResponseSchema.safeParse({ vectors: [[0.1, 0.2, 0.3]], usage: { inputTokens: 5 } });
    expect(result.success).toBe(true);
  });

  it("should reject missing usage", () => {
    const result = EmbedResponseSchema.safeParse({ vectors: [[0.1]] });
    expect(result.success).toBe(false);
  });
});
