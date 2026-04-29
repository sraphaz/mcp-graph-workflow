/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi } from "vitest";
import { AnthropicAdapter } from "../core/llm/adapters/anthropic.js";

/** Build a fake ReadableStream body from SSE text lines. */
function sseBody(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
}

function makeFetch(body: ReadableStream<Uint8Array>, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    body,
    json: async () => ({}),
    text: async () => "error body",
  } as unknown as Response);
}

describe("AnthropicAdapter.generateStream() — SSE streaming", () => {
  it("calls streamDelta for each content_block_delta text event", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "test-key",
      fetchImpl: makeFetch(
        sseBody([
          { type: "message_start", message: { usage: { input_tokens: 10, output_tokens: 0 } } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: " World" } },
          { type: "message_delta", usage: { output_tokens: 5 } },
          { type: "message_stop" },
        ]),
      ),
    });

    const chunks: string[] = [];
    await adapter.generateStream(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      (chunk: string | null) => { if (chunk !== null) chunks.push(chunk); },
    );
    expect(chunks).toEqual(["Hello", " World"]);
  });

  it("calls streamDelta(null) as the final terminator", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "test-key",
      fetchImpl: makeFetch(
        sseBody([
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hi" } },
          { type: "message_stop" },
        ]),
      ),
    });

    const received: Array<string | null> = [];
    await adapter.generateStream(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      (chunk: string | null) => { received.push(chunk); },
    );
    expect(received[received.length - 1]).toBeNull();
  });

  it("returns LlmResponse with concatenated content from all deltas", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "test-key",
      fetchImpl: makeFetch(
        sseBody([
          { type: "message_start", message: { usage: { input_tokens: 8, output_tokens: 0 } } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Foo" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Bar" } },
          { type: "message_delta", usage: { output_tokens: 3 } },
          { type: "message_stop" },
        ]),
      ),
    });

    const res = await adapter.generateStream(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      () => {},
    );
    expect(res.content).toBe("FooBar");
    expect(res.kind).toBe("final");
    expect(res.usage.inputTokens).toBe(8);
    expect(res.usage.outputTokens).toBe(3);
  });

  it("ignores non-text_delta events (message_start, message_delta, message_stop)", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "test-key",
      fetchImpl: makeFetch(
        sseBody([
          { type: "message_start", message: { usage: { input_tokens: 5, output_tokens: 0 } } },
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "OK" } },
          { type: "content_block_stop", index: 0 },
          { type: "message_delta", usage: { output_tokens: 1 } },
          { type: "message_stop" },
        ]),
      ),
    });

    const chunks: Array<string | null> = [];
    await adapter.generateStream(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      (chunk: string | null) => { chunks.push(chunk); },
    );
    const nonNull = chunks.filter((c) => c !== null);
    expect(nonNull).toEqual(["OK"]);
  });

  it("sends stream:true in the request body", async () => {
    const fetchMock = makeFetch(
      sseBody([
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "x" } },
        { type: "message_stop" },
      ]),
    );
    const adapter = new AnthropicAdapter({ apiKey: "key", fetchImpl: fetchMock });
    await adapter.generateStream(
      { model: "anthropic/claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] },
      () => {},
    );
    const callBody = JSON.parse((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(callBody["stream"]).toBe(true);
  });
});
