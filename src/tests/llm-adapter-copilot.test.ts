/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { CopilotAdapter, COPILOT_EDITOR_VERSION } from "../core/llm/adapters/copilot.js";
import { LlmAuthError, LlmRateLimitError } from "../core/llm/errors.js";

const chatCompletionBody = {
  id: "chat_1",
  object: "chat.completion",
  model: "gpt-4.1",
  choices: [{ message: { content: "ok" }, finish_reason: "stop", index: 0 }],
  usage: { prompt_tokens: 10, completion_tokens: 3 },
};

function fetchWithCapture(
  status: number,
  body: unknown,
): { fetchImpl: typeof fetch; lastInit: () => RequestInit | undefined } {
  let lastInit: RequestInit | undefined;
  const fetchImpl = (async (_url: string | URL, init?: RequestInit) => {
    lastInit = init;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, lastInit: () => lastInit };
}

describe("CopilotAdapter", () => {
  it("generate() returns LlmResponse from choices[0].message.content on 200", async () => {
    const { fetchImpl } = fetchWithCapture(200, chatCompletionBody);
    const adapter = new CopilotAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    const res = await adapter.generate({
      model: "copilot/gpt-4.1",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.content).toBe("ok");
    expect(res.usage.inputTokens).toBe(10);
    expect(res.usage.outputTokens).toBe(3);
  });

  it("preserves editor-version header exactly = 'mcp-graph/1'", async () => {
    const { fetchImpl, lastInit } = fetchWithCapture(200, chatCompletionBody);
    const adapter = new CopilotAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await adapter.generate({
      model: "copilot/gpt-4.1",
      messages: [{ role: "user", content: "h" }],
    });
    const headers = lastInit()!.headers as Record<string, string>;
    const lowerKeys = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    );
    expect(lowerKeys["editor-version"]).toBe(COPILOT_EDITOR_VERSION);
    expect(COPILOT_EDITOR_VERSION).toBe("mcp-graph/1");
  });

  it("throws LlmAuthError on 401", async () => {
    const { fetchImpl } = fetchWithCapture(401, { error: "no" });
    const adapter = new CopilotAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await expect(
      adapter.generate({ model: "copilot/gpt-4.1", messages: [{ role: "user", content: "h" }] }),
    ).rejects.toBeInstanceOf(LlmAuthError);
  });

  it("throws LlmRateLimitError on 429", async () => {
    const { fetchImpl } = fetchWithCapture(429, { error: "slow" });
    const adapter = new CopilotAdapter({
      apiKey: "k",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 1 },
    });
    await expect(
      adapter.generate({ model: "copilot/gpt-4.1", messages: [{ role: "user", content: "h" }] }),
    ).rejects.toBeInstanceOf(LlmRateLimitError);
  });

  it("models() includes copilot/gpt-4.1", () => {
    const adapter = new CopilotAdapter({ apiKey: "k" });
    const ids = adapter.models().map((m) => m.id);
    expect(ids).toContain("copilot/gpt-4.1");
  });
});
