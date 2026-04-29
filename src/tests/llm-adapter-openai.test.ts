/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { OpenAIAdapter } from "../core/llm/adapters/openai.js";
import { LlmAuthError, LlmTransportError } from "../core/llm/errors.js";

const chatBody = {
  id: "oai_1",
  object: "chat.completion",
  model: "gpt-4o-mini",
  choices: [{ message: { content: "ok" }, finish_reason: "stop", index: 0 }],
  usage: { prompt_tokens: 6, completion_tokens: 2 },
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
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, lastBody: () => last };
}

describe("OpenAIAdapter", () => {
  it("generate() returns normalized LlmResponse on 200", async () => {
    const { fetchImpl } = captured(200, chatBody);
    const adapter = new OpenAIAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    const res = await adapter.generate({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "h" }],
    });
    expect(res.content).toBe("ok");
    expect(res.usage.outputTokens).toBe(2);
  });

  it("strips 'openai/' prefix from model id in request body", async () => {
    const { fetchImpl, lastBody } = captured(200, chatBody);
    const adapter = new OpenAIAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await adapter.generate({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "h" }],
    });
    expect((lastBody() as { model: string }).model).toBe("gpt-4o-mini");
  });

  it("throws LlmAuthError on 401", async () => {
    const { fetchImpl } = captured(401, { error: "no" });
    const adapter = new OpenAIAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await expect(
      adapter.generate({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "h" }] }),
    ).rejects.toBeInstanceOf(LlmAuthError);
  });

  it("throws LlmTransportError on 503", async () => {
    const { fetchImpl } = captured(503, "down");
    const adapter = new OpenAIAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await expect(
      adapter.generate({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "h" }] }),
    ).rejects.toBeInstanceOf(LlmTransportError);
  });

  it("models() includes openai/gpt-4o-mini", () => {
    const adapter = new OpenAIAdapter({ apiKey: "k" });
    const ids = adapter.models().map((m) => m.id);
    expect(ids).toContain("openai/gpt-4o-mini");
  });
});
