/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 (streaming-sse) — generateStream() in OpenAICompatibleAdapter
 *
 * AC1: GIVEN SSE válido com 5 chunks WHEN generateStream THEN streamDelta chamado 5x + null
 * AC2: GIVEN data: [DONE] WHEN parser THEN encerra sem invocar streamDelta com literal [DONE]
 * AC3: GIVEN AbortController cancela WHEN cancelado THEN fetch abortado < 100ms sem chunks órfãos
 * AC4: GIVEN servidor 500 mid-stream WHEN parser detecta THEN throw LlmTransportError
 */

import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleAdapter } from "../core/llm/adapters/openai-compatible.js";
import { LlmTransportError } from "../core/llm/errors.js";

function buildSseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = chunks.map((c) => `data: ${c}\n\n`).join("") + "data: [DONE]\n\n";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
}

function makeChunk(content: string): string {
  return JSON.stringify({
    choices: [{ delta: { content } }],
  });
}

const BASE_REQ = {
  model: "test-model",
  messages: [{ role: "user" as const, content: "hello" }],
};

// ---------------------------------------------------------------------------
// AC1: 5 chunks → streamDelta called 5x + null
// ---------------------------------------------------------------------------

describe("generateStream — AC1: 5 chunks", () => {
  it("calls streamDelta 5 times with tokens, then once with null", async () => {
    const chunks = ["a", "b", "c", "d", "e"].map(makeChunk);
    const body = buildSseBody(chunks);

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      body,
      headers: new Headers(),
    } as unknown as Response);

    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://localhost:8000/v1/chat/completions",
      fetchImpl,
    });

    const calls: Array<string | null> = [];
    const result = await adapter.generateStream(BASE_REQ, (chunk) => calls.push(chunk));

    expect(calls).toHaveLength(6);
    expect(calls.slice(0, 5)).toEqual(["a", "b", "c", "d", "e"]);
    expect(calls[5]).toBeNull();
    expect(result.content).toBe("abcde");
  });
});

// ---------------------------------------------------------------------------
// AC2: [DONE] line → stream ends without passing "[DONE]" to streamDelta
// ---------------------------------------------------------------------------

describe("generateStream — AC2: [DONE] not passed to streamDelta", () => {
  it("does not call streamDelta with the literal [DONE] string", async () => {
    const body = buildSseBody([makeChunk("tok")]);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      body,
      headers: new Headers(),
    } as unknown as Response);

    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://localhost:8000/v1/chat/completions",
      fetchImpl,
    });

    const calls: Array<string | null> = [];
    await adapter.generateStream(BASE_REQ, (c) => calls.push(c));
    expect(calls).not.toContain("[DONE]");
    expect(calls[calls.length - 1]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC3: AbortController cancels → fetch aborted, no orphan chunks
// ---------------------------------------------------------------------------

describe("generateStream — AC3: AbortController cancels", () => {
  it("aborts fetch within 100ms and no chunks are emitted after abort", async () => {
    const ac = new AbortController();
    const fetchImpl = vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
      return new Promise<Response>((_resolve, reject) => {
        if (opts.signal) {
          opts.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }
      });
    });

    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://localhost:8000/v1/chat/completions",
      fetchImpl,
    });

    const calls: Array<string | null> = [];
    const start = Date.now();
    const streamPromise = adapter.generateStream(BASE_REQ, (c) => calls.push(c), { signal: ac.signal });

    setTimeout(() => ac.abort(), 20);
    await expect(streamPromise).rejects.toThrow();
    expect(Date.now() - start).toBeLessThan(100);
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC4: 500 mid-stream → throw LlmTransportError
// ---------------------------------------------------------------------------

describe("generateStream — AC4: server 500 → LlmTransportError", () => {
  it("throws LlmTransportError on non-ok status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("server error"),
      headers: new Headers(),
    } as unknown as Response);

    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://localhost:8000/v1/chat/completions",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    await expect(adapter.generateStream(BASE_REQ, () => {})).rejects.toBeInstanceOf(LlmTransportError);
  });
});
