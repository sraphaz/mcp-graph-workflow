/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startProxyServer, type ProxyServerHandle } from "../core/proxy/server.js";
import { toLlmRequest, toOpenAiResponse, OpenAiChatCompletionRequestSchema } from "../core/proxy/openai-shape.js";
import type { LlmGateway } from "../core/llm/gateway.js";
import type { LlmRequest, LlmResponse } from "../core/llm/types.js";

class FakeGateway {
  public lastRequest: LlmRequest | null = null;
  public response: LlmResponse = {
    model: "gpt-4o-mini",
    content: "Hello from fake LLM",
    usage: { inputTokens: 10, outputTokens: 5 },
  };
  public throws: Error | null = null;
  generate = async (req: LlmRequest): Promise<LlmResponse> => {
    this.lastRequest = req;
    if (this.throws) throw this.throws;
    return this.response;
  };
}

describe("OpenAI shape — schema + converters", () => {
  it("rejects empty messages array", () => {
    const r = OpenAiChatCompletionRequestSchema.safeParse({ model: "x", messages: [] });
    expect(r.success).toBe(false);
  });

  it("accepts a minimal valid request", () => {
    const r = OpenAiChatCompletionRequestSchema.safeParse({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(r.success).toBe(true);
  });

  it("toLlmRequest passes max_tokens and temperature through", () => {
    const llm = toLlmRequest({
      model: "x",
      messages: [{ role: "user", content: "y" }],
      max_tokens: 200,
      temperature: 0.7,
    });
    expect(llm.maxTokens).toBe(200);
    expect(llm.temperature).toBe(0.7);
    expect(llm.stream).toBe(false);
  });

  it("toLlmRequest throws on stream:true (v1 non-streaming only)", () => {
    expect(() => toLlmRequest({
      model: "x",
      messages: [{ role: "user", content: "y" }],
      stream: true,
    })).toThrow(/streaming not supported/);
  });

  it("toLlmRequest downgrades tool role to user with [tool] prefix", () => {
    const llm = toLlmRequest({
      model: "x",
      messages: [
        { role: "user", content: "hi" },
        { role: "tool", content: "result-payload" },
      ],
    });
    expect(llm.messages).toHaveLength(2);
    expect(llm.messages[1].role).toBe("user");
    expect(llm.messages[1].content).toBe("[tool] result-payload");
  });

  it("toOpenAiResponse produces a valid chat.completion shape", () => {
    const out = toOpenAiResponse({
      model: "gpt-4o-mini",
      content: "answer",
      usage: { inputTokens: 7, outputTokens: 3 },
    });
    expect(out.object).toBe("chat.completion");
    expect(out.id).toMatch(/^chatcmpl-[0-9a-f]+/);
    expect(out.choices).toHaveLength(1);
    expect(out.choices[0].message).toEqual({ role: "assistant", content: "answer" });
    expect(out.choices[0].finish_reason).toBe("stop");
    expect(out.usage).toEqual({ prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 });
    expect(typeof out.created).toBe("number");
  });
});

describe("Proxy HTTP server — /healthz + /v1/chat/completions", () => {
  let handle: ProxyServerHandle;
  let gw: FakeGateway;
  const TOKEN = "test-bearer-secret";

  beforeEach(async () => {
    gw = new FakeGateway();
    handle = await startProxyServer({
      gateway: gw as unknown as LlmGateway,
      bearerToken: TOKEN,
      port: 0,
      models: [{ id: "gpt-4o-mini" }],
    });
  });

  afterEach(async () => {
    await handle.close();
  });

  it("Subtask 1: GET /healthz returns 200 ok without auth", async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("rejects /v1/* without bearer", async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "x", messages: [{ role: "user", content: "hi" }] }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects /v1/* with wrong bearer", async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer wrong" },
      body: JSON.stringify({ model: "x", messages: [{ role: "user", content: "hi" }] }),
    });
    expect(res.status).toBe(401);
  });

  it("Subtask 2: POST /v1/chat/completions returns OpenAI-compatible shape", async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe("chat.completion");
    expect(body.id).toMatch(/^chatcmpl-/);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.choices[0].message).toEqual({ role: "assistant", content: "Hello from fake LLM" });
    expect(body.choices[0].finish_reason).toBe("stop");
    expect(body.usage.total_tokens).toBe(15);

    expect(gw.lastRequest?.model).toBe("gpt-4o-mini");
    expect(gw.lastRequest?.messages[0]).toEqual({ role: "user", content: "ping" });
  });

  it("400 on invalid JSON body", async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: "{ broken json",
    });
    expect(res.status).toBe(400);
  });

  it("400 on stream:true (v1 non-streaming only)", async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ model: "x", messages: [{ role: "user", content: "hi" }], stream: true }),
    });
    expect(res.status).toBe(400);
  });

  it("429 maps from LlmBudgetExceededError", async () => {
    const err = new Error("budget exceeded");
    err.name = "LlmBudgetExceededError";
    gw.throws = err;
    const res = await fetch(`http://127.0.0.1:${handle.port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ model: "x", messages: [{ role: "user", content: "hi" }] }),
    });
    expect(res.status).toBe(429);
  });

  it("GET /v1/models returns the configured list", async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/v1/models`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe("list");
    expect(body.data[0].id).toBe("gpt-4o-mini");
  });

  it("OPTIONS pre-flight returns 204 with CORS headers", async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/v1/chat/completions`, {
      method: "OPTIONS",
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("404 on unknown path", async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/v1/unknown`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(404);
  });
});

describe("Proxy server — disabled when no bearerToken", () => {
  it("/v1/* returns 503 when started without bearerToken", async () => {
    const gw = new FakeGateway();
    const handle = await startProxyServer({
      gateway: gw as unknown as LlmGateway,
      port: 0,
    });
    try {
      const res = await fetch(`http://127.0.0.1:${handle.port}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer anything" },
        body: JSON.stringify({ model: "x", messages: [{ role: "user", content: "hi" }] }),
      });
      expect(res.status).toBe(503);
    } finally {
      await handle.close();
    }
  });
});
