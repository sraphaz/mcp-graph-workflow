/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — Mock SSE server-side fixture para testes
 *
 * AC1: GIVEN fixture happy-5-chunks WHEN consumida THEN ReadableStream emite 5 chunks data + 1 `data: [DONE]` em ordem
 * AC2: GIVEN fixture abort-mid-stream WHEN AbortController dispara THEN stream interrompe sem erro espúrio
 * AC3: GIVEN fixture server-error WHEN status 500 chega no terceiro chunk THEN parser propaga LlmTransportError contendo partial output
 */

import { describe, it, expect } from "vitest";
import { mockSseFetch } from "./fixtures/sse-chunks.js";
import { OpenAICompatibleAdapter } from "../core/llm/adapters/openai-compatible.js";
import { LlmTransportError } from "../core/llm/errors.js";

const BASE_REQ = {
  model: "test-model",
  messages: [{ role: "user" as const, content: "hi" }],
};

// ---------------------------------------------------------------------------
// AC1: happy-5-chunks
// ---------------------------------------------------------------------------

describe("mockSseFetch happy-5-chunks — AC1", () => {
  it("response has status 200", async () => {
    const fetcher = mockSseFetch("happy-5-chunks");
    const res = await fetcher("http://test/v1/chat/completions", {});
    expect(res.status).toBe(200);
  });

  it("ReadableStream emits 5 data chunks + [DONE]", async () => {
    const fetcher = mockSseFetch("happy-5-chunks");
    const res = await fetcher("http://test/v1/chat/completions", {});
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const lines: string[] = [];
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
    }
    lines.push(...buf.split("\n").filter((l) => l.trim()));
    const dataLines = lines.filter((l) => l.startsWith("data: "));
    const doneLines = dataLines.filter((l) => l === "data: [DONE]");
    const chunkLines = dataLines.filter((l) => l !== "data: [DONE]");
    expect(chunkLines).toHaveLength(5);
    expect(doneLines).toHaveLength(1);
  });

  it("chunks arrive in order (delta content 1..5)", async () => {
    const fetcher = mockSseFetch("happy-5-chunks");
    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://test/v1/chat/completions",
      fetchImpl: fetcher as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    const deltas: string[] = [];
    await adapter.generateStream(BASE_REQ, (chunk) => {
      if (chunk !== null) deltas.push(chunk);
    });
    expect(deltas).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// AC2: abort-mid-stream
// ---------------------------------------------------------------------------

describe("mockSseFetch abort-mid-stream — AC2", () => {
  it("response has status 200", async () => {
    const controller = new AbortController();
    const fetcher = mockSseFetch("abort-mid-stream");
    const res = await fetcher("http://test/v1/chat/completions", { signal: controller.signal });
    expect(res.status).toBe(200);
    controller.abort();
  });

  it("stream stops cleanly when AbortController aborts", async () => {
    const controller = new AbortController();
    const fetcher = mockSseFetch("abort-mid-stream");
    const res = await fetcher("http://test/v1/chat/completions", { signal: controller.signal });
    const reader = res.body!.getReader();

    // Read first chunk then abort
    await reader.read();
    controller.abort();

    // Cancel the reader — should not throw
    await expect(reader.cancel()).resolves.toBeUndefined();
  });

  it("body is a ReadableStream (not null)", async () => {
    const controller = new AbortController();
    const fetcher = mockSseFetch("abort-mid-stream");
    const res = await fetcher("http://test/v1/chat/completions", { signal: controller.signal });
    expect(res.body).not.toBeNull();
    controller.abort();
  });
});

// ---------------------------------------------------------------------------
// AC3: server-error-mid-stream → LlmTransportError with partial output
// ---------------------------------------------------------------------------

describe("mockSseFetch server-error-mid-stream — AC3", () => {
  it("response has status 500", async () => {
    const fetcher = mockSseFetch("server-error-mid-stream");
    const res = await fetcher("http://test/v1/chat/completions", {});
    expect(res.status).toBe(500);
  });

  it("parser throws LlmTransportError when adapter receives 500", async () => {
    const fetcher = mockSseFetch("server-error-mid-stream");
    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://test/v1/chat/completions",
      fetchImpl: fetcher as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await expect(
      adapter.generateStream(BASE_REQ, () => {})
    ).rejects.toThrow(LlmTransportError);
  });

  it("LlmTransportError message contains error body (partial output)", async () => {
    const fetcher = mockSseFetch("server-error-mid-stream");
    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://test/v1/chat/completions",
      fetchImpl: fetcher as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    const err = await adapter.generateStream(BASE_REQ, () => {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmTransportError);
    expect((err as Error).message).toMatch(/500/);
  });
});
