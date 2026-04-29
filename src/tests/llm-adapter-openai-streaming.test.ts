/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi } from "vitest";
import { OpenAIAdapter } from "../core/llm/adapters/openai.js";

function sseBody(events: Array<object | "[DONE]">): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = events
    .map((e) => (e === "[DONE]" ? "data: [DONE]\n\n" : `data: ${JSON.stringify(e)}\n\n`))
    .join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
}

function makeFetch(body: ReadableStream<Uint8Array>): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    body,
    json: async () => ({}),
    text: async () => "",
  } as unknown as Response);
}

function chunk(content: string, finishReason: string | null = null) {
  return {
    object: "chat.completion.chunk",
    choices: [{ delta: { content }, finish_reason: finishReason, index: 0 }],
  };
}

function doneChunk(promptTokens = 10, completionTokens = 5) {
  return {
    object: "chat.completion.chunk",
    choices: [{ delta: {}, finish_reason: "stop", index: 0 }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
  };
}

describe("OpenAIAdapter.generateStream() — SSE streaming", () => {
  it("calls streamDelta for each chunk with non-null delta content", async () => {
    const adapter = new OpenAIAdapter({
      apiKey: "test-key",
      fetchImpl: makeFetch(sseBody([chunk("Hello"), chunk(" World"), doneChunk(), "[DONE]"])),
    });

    const received: string[] = [];
    await adapter.generateStream(
      { model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }] },
      (c: string | null) => { if (c !== null) received.push(c); },
    );
    expect(received).toEqual(["Hello", " World"]);
  });

  it("calls streamDelta(null) as the final terminator", async () => {
    const adapter = new OpenAIAdapter({
      apiKey: "test-key",
      fetchImpl: makeFetch(sseBody([chunk("Hi"), doneChunk(), "[DONE]"])),
    });

    const received: Array<string | null> = [];
    await adapter.generateStream(
      { model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }] },
      (c: string | null) => { received.push(c); },
    );
    expect(received[received.length - 1]).toBeNull();
  });

  it("returns LlmResponse with concatenated content and usage tokens", async () => {
    const adapter = new OpenAIAdapter({
      apiKey: "test-key",
      fetchImpl: makeFetch(sseBody([chunk("Foo"), chunk("Bar"), doneChunk(8, 3), "[DONE]"])),
    });

    const res = await adapter.generateStream(
      { model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }] },
      () => {},
    );
    expect(res.content).toBe("FooBar");
    expect(res.kind).toBe("final");
    expect(res.usage.inputTokens).toBe(8);
    expect(res.usage.outputTokens).toBe(3);
  });

  it("skips [DONE] sentinel and chunks with empty delta.content", async () => {
    const adapter = new OpenAIAdapter({
      apiKey: "test-key",
      fetchImpl: makeFetch(
        sseBody([
          { object: "chat.completion.chunk", choices: [{ delta: {}, finish_reason: null, index: 0 }] },
          chunk("OK"),
          doneChunk(),
          "[DONE]",
        ]),
      ),
    });

    const received: Array<string | null> = [];
    await adapter.generateStream(
      { model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }] },
      (c: string | null) => { received.push(c); },
    );
    const nonNull = received.filter((c) => c !== null);
    expect(nonNull).toEqual(["OK"]);
  });

  it("sends stream:true in the request body", async () => {
    const fetchMock = makeFetch(sseBody([chunk("x"), doneChunk(), "[DONE]"]));
    const adapter = new OpenAIAdapter({ apiKey: "key", fetchImpl: fetchMock });
    await adapter.generateStream(
      { model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }] },
      () => {},
    );
    const callBody = JSON.parse(
      (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    ) as Record<string, unknown>;
    expect(callBody["stream"]).toBe(true);
  });
});
