/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { AnthropicAdapter } from "../core/llm/adapters/anthropic.js";
import {
  LlmAuthError,
  LlmRateLimitError,
  LlmTransportError,
} from "../core/llm/errors.js";

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}): typeof fetch {
  return (async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    })) as typeof fetch;
}

const anthropicSuccessBody = {
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-haiku-4-5",
  content: [{ type: "text", text: "hello world" }],
  usage: { input_tokens: 12, output_tokens: 5 },
};

describe("AnthropicAdapter", () => {
  it("generate() returns LlmResponse with content from content[0].text on 200", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "k",
      fetchImpl: mockFetch(200, anthropicSuccessBody),
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    const res = await adapter.generate({
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.content).toBe("hello world");
    expect(res.model).toBe("anthropic/claude-haiku-4-5");
    expect(res.usage.inputTokens).toBe(12);
    expect(res.usage.outputTokens).toBe(5);
  });

  it("throws LlmAuthError on 401 with provider='anthropic'", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "k",
      fetchImpl: mockFetch(401, { error: "invalid key" }),
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await expect(
      adapter.generate({ model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "h" }] }),
    ).rejects.toBeInstanceOf(LlmAuthError);
  });

  it("throws LlmRateLimitError with retryAfterMs from header on 429", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "k",
      fetchImpl: mockFetch(429, { error: "slow down" }, { "retry-after": "3" }),
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    try {
      await adapter.generate({
        model: "anthropic/claude-haiku-4-5",
        messages: [{ role: "user", content: "h" }],
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LlmRateLimitError);
      expect((err as LlmRateLimitError).retryAfterMs).toBe(3000);
    }
  });

  it("throws LlmTransportError on 502", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "k",
      fetchImpl: mockFetch(502, "bad gateway"),
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await expect(
      adapter.generate({ model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "h" }] }),
    ).rejects.toBeInstanceOf(LlmTransportError);
  });

  it("system message goes to top-level `system` field, not into messages[]", async () => {
    let captured: { system?: string; messages?: Array<{ role: string }> } | null = null;
    const adapter = new AnthropicAdapter({
      apiKey: "k",
      fetchImpl: (async (_url, init) => {
        captured = JSON.parse((init?.body as string) ?? "{}");
        return new Response(JSON.stringify(anthropicSuccessBody), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await adapter.generate({
      model: "anthropic/claude-haiku-4-5",
      messages: [
        { role: "system", content: "be brief" },
        { role: "user", content: "hi" },
      ],
    });
    expect(captured!.system).toBe("be brief");
    expect(captured!.messages).toHaveLength(1);
    expect(captured!.messages![0].role).toBe("user");
  });

  it("models() returns at least one ModelSpec with provider='anthropic'", () => {
    const adapter = new AnthropicAdapter({ apiKey: "k" });
    const models = adapter.models();
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.provider === "anthropic")).toBe(true);
  });

  it("name property equals 'anthropic'", () => {
    const adapter = new AnthropicAdapter({ apiKey: "k" });
    expect(adapter.name).toBe("anthropic");
  });
});
