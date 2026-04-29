/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { OpenRouterAdapter } from "../core/llm/adapters/openrouter.js";
import { LlmAuthError, LlmRateLimitError } from "../core/llm/errors.js";

const chatBody = {
  id: "or_1",
  object: "chat.completion",
  model: "openrouter/auto",
  choices: [{ message: { content: "ok" }, finish_reason: "stop", index: 0 }],
  usage: { prompt_tokens: 8, completion_tokens: 4 },
};

function captured(status: number, body: unknown): {
  fetchImpl: typeof fetch;
  lastBody: () => unknown;
} {
  let last: unknown;
  const fetchImpl = (async (_url: string | URL, init?: RequestInit) => {
    last = init?.body ? JSON.parse(init.body as string) : undefined;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", "retry-after": "2" },
    });
  }) as typeof fetch;
  return { fetchImpl, lastBody: () => last };
}

describe("OpenRouterAdapter", () => {
  it("generate() returns normalized LlmResponse on 200", async () => {
    const { fetchImpl } = captured(200, chatBody);
    const adapter = new OpenRouterAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    const res = await adapter.generate({
      model: "openrouter/auto",
      messages: [{ role: "user", content: "h" }],
    });
    expect(res.content).toBe("ok");
    expect(res.usage.inputTokens).toBe(8);
  });

  it("model id passes through (no prefix strip)", async () => {
    const { fetchImpl, lastBody } = captured(200, chatBody);
    const adapter = new OpenRouterAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await adapter.generate({
      model: "openrouter/auto",
      messages: [{ role: "user", content: "h" }],
    });
    expect((lastBody() as { model: string }).model).toBe("openrouter/auto");
  });

  it("throws LlmAuthError on 401", async () => {
    const { fetchImpl } = captured(401, { error: "no" });
    const adapter = new OpenRouterAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await expect(
      adapter.generate({ model: "openrouter/auto", messages: [{ role: "user", content: "h" }] }),
    ).rejects.toBeInstanceOf(LlmAuthError);
  });

  it("throws LlmRateLimitError with retryAfterMs from header on 429", async () => {
    const { fetchImpl } = captured(429, { error: "slow" });
    const adapter = new OpenRouterAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    try {
      await adapter.generate({
        model: "openrouter/auto",
        messages: [{ role: "user", content: "h" }],
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LlmRateLimitError);
      expect((err as LlmRateLimitError).retryAfterMs).toBe(2000);
    }
  });

  it("models() includes openrouter/auto", () => {
    const adapter = new OpenRouterAdapter({ apiKey: "k" });
    const ids = adapter.models().map((m) => m.id);
    expect(ids).toContain("openrouter/auto");
  });
});
