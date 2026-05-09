/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — embed() no OpenAICompatibleAdapter
 *
 * AC1: GIVEN servidor responde data com 1 embedding 384-dim WHEN embed roda THEN retorna vectors=[[384 numbers]]
 * AC2: GIVEN input string[] de 5 textos WHEN embed roda THEN retorna 5 vectors em ordem preservada
 * AC3: GIVEN servidor offline WHEN embed roda THEN throw LlmTransportError em < 1s
 * AC4: GIVEN response sem `usage` WHEN parseado THEN reporta usage.inputTokens=0 sem crash
 */

import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleAdapter } from "../core/llm/adapters/openai-compatible.js";
import { LlmTransportError } from "../core/llm/errors.js";

function makeEmbedding(dim: number): number[] {
  return Array.from({ length: dim }, (_, i) => i / dim);
}

// ---------------------------------------------------------------------------
// AC1: 1 embedding 384-dim
// ---------------------------------------------------------------------------

describe("embed — AC1: single 384-dim embedding", () => {
  it("returns vectors with one 384-element array", async () => {
    const embedding = makeEmbedding(384);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () =>
        Promise.resolve({
          data: [{ embedding }],
          usage: { prompt_tokens: 12 },
        }),
    } as unknown as Response);

    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://localhost:8000/v1/chat/completions",
      fetchImpl,
    });

    const result = await adapter.embed!({ model: "bge-small", input: "hello" });

    expect(result.vectors).toHaveLength(1);
    expect(result.vectors[0]).toHaveLength(384);
    expect(result.vectors[0]).toEqual(embedding);
  });
});

// ---------------------------------------------------------------------------
// AC2: 5 strings → 5 vectors in preserved order
// ---------------------------------------------------------------------------

describe("embed — AC2: 5 inputs → 5 vectors in order", () => {
  it("returns 5 vectors matching input order", async () => {
    const embeddings = Array.from({ length: 5 }, (_, i) => makeEmbedding(i + 1));
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () =>
        Promise.resolve({
          data: embeddings.map((embedding) => ({ embedding })),
          usage: { prompt_tokens: 50 },
        }),
    } as unknown as Response);

    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://localhost:8000/v1/chat/completions",
      fetchImpl,
    });

    const inputs = ["a", "b", "c", "d", "e"];
    const result = await adapter.embed!({ model: "bge-small", input: inputs });

    expect(result.vectors).toHaveLength(5);
    result.vectors.forEach((vec, i) => {
      expect(vec).toEqual(embeddings[i]);
    });
  });

  it("sends the input array to the /v1/embeddings endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () =>
        Promise.resolve({
          data: [{ embedding: [0.1, 0.2] }],
          usage: { prompt_tokens: 5 },
        }),
    } as unknown as Response);

    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://localhost:8000/v1/chat/completions",
      fetchImpl,
    });

    await adapter.embed!({ model: "bge-small", input: ["text1"] });

    const [url, opts] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/embeddings");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["input"]).toEqual(["text1"]);
  });
});

// ---------------------------------------------------------------------------
// AC3: server offline → LlmTransportError < 1s
// ---------------------------------------------------------------------------

describe("embed — AC3: offline → LlmTransportError", () => {
  it("throws LlmTransportError when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://localhost:8000/v1/chat/completions",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    const start = Date.now();
    await expect(adapter.embed!({ model: "bge-small", input: "hi" })).rejects.toBeInstanceOf(
      LlmTransportError,
    );
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// AC4: missing usage → inputTokens = 0, no crash
// ---------------------------------------------------------------------------

describe("embed — AC4: missing usage → inputTokens=0", () => {
  it("returns usage.inputTokens=0 when response has no usage field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () =>
        Promise.resolve({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          // no usage field
        }),
    } as unknown as Response);

    const adapter = new OpenAICompatibleAdapter({
      providerId: "test",
      baseUrl: "http://localhost:8000/v1/chat/completions",
      fetchImpl,
    });

    const result = await adapter.embed!({ model: "bge-small", input: "test" });
    expect(result.usage.inputTokens).toBe(0);
  });
});
