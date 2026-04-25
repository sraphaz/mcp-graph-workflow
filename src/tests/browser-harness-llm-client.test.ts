/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LlmClient } from "../core/browser-harness/llm-client.js";

function makeResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("LlmClient — Anthropic provider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("sends a Messages-API request and returns text", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse({
        content: [{ type: "text", text: "hello world" }],
        usage: { input_tokens: 5, output_tokens: 2 },
      }),
    );
    const client = new LlmClient({ provider: "anthropic", apiKey: "sk-ant-xxx", model: "claude-opus-4-7", fetchImpl: fetchMock });
    const result = await client.generate([{ role: "user", content: "hi" }]);
    expect(result.text).toBe("hello world");
    expect(result.usage?.inputTokens).toBe(5);

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("https://api.anthropic.com/v1/messages");
    expect(call[1]?.headers).toMatchObject({
      "x-api-key": "sk-ant-xxx",
      "anthropic-version": expect.any(String),
    });
    const body = JSON.parse(call[1]?.body as string);
    expect(body.model).toBe("claude-opus-4-7");
  });

  it("retries on 429 with backoff", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ type: "error", error: { message: "slow down" } }, { status: 429 }))
      .mockResolvedValueOnce(
        makeResponse({
          content: [{ type: "text", text: "ok" }],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      );
    const client = new LlmClient({ provider: "anthropic", apiKey: "sk-ant-xxx", model: "claude-opus-4-7", fetchImpl: fetchMock, retry: { maxAttempts: 3, baseDelayMs: 10 } });
    const promise = client.generate([{ role: "user", content: "hi" }]);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.text).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse({ type: "error", error: { message: "bad" } }, { status: 400 }),
    );
    const client = new LlmClient({ provider: "anthropic", apiKey: "sk-ant-xxx", model: "claude-opus-4-7", fetchImpl: fetchMock });
    await expect(client.generate([{ role: "user", content: "hi" }])).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("probe returns ok:true on a successful 1-token ping", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse({ content: [{ type: "text", text: "." }], usage: { input_tokens: 1, output_tokens: 1 } }),
    );
    const client = new LlmClient({ provider: "anthropic", apiKey: "sk-ant-xxx", model: "claude-opus-4-7", fetchImpl: fetchMock });
    const res = await client.probe();
    expect(res.ok).toBe(true);
  });

  it("probe returns ok:false on 401", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse({ error: { message: "unauthorized" } }, { status: 401 }),
    );
    const client = new LlmClient({ provider: "anthropic", apiKey: "sk-ant-bad", model: "claude-opus-4-7", fetchImpl: fetchMock });
    const res = await client.probe();
    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
  });
});

describe("LlmClient — Copilot provider", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("sends an OpenAI-compatible request with Copilot headers", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse({
        choices: [{ message: { content: "hi copilot" } }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      }),
    );
    const client = new LlmClient({ provider: "copilot", apiKey: "ghu_xxx", model: "gpt-5", fetchImpl: fetchMock });
    const result = await client.generate([{ role: "user", content: "hi" }]);
    expect(result.text).toBe("hi copilot");

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("https://api.githubcopilot.com/chat/completions");
    expect(call[1]?.headers).toMatchObject({
      authorization: "Bearer ghu_xxx",
      "editor-version": expect.any(String),
    });
  });
});
