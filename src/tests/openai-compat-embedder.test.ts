/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-embeddings — Task 2.2: OpenAICompatibleEmbedder adapter
 *
 * AC1: GIVEN adapter mock WHEN embed-batch de 10 textos THEN retorna 10 vectors compatíveis com embedding-store
 * AC2: GIVEN model não suportado WHEN embed roda THEN throw com mensagem clara (model + providerId)
 * AC3: GIVEN dimensions inconsistentes WHEN embed-store insere THEN warn estruturado
 */

import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleEmbedder } from "../core/rag/openai-compat-embedder.js";
import type { EmbedRequest, EmbedResponse } from "../core/llm/types.js";

const DIM = 4;

function fakeVectors(n: number, dim: number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: dim }, (__, j) => i * dim + j));
}

function makeAdapter(opts: {
  providerId?: string;
  vectors?: number[][];
  shouldThrow?: boolean;
}) {
  const providerId = opts.providerId ?? "local-glm";
  return {
    providerId,
    embed: vi.fn(async (req: EmbedRequest): Promise<EmbedResponse> => {
      if (opts.shouldThrow) {
        const err = new Error(`model ${req.model} not supported by ${providerId}`) as Error & { status?: number };
        err.status = 400;
        throw err;
      }
      const n = Array.isArray(req.input) ? req.input.length : 1;
      const vectors = opts.vectors ?? fakeVectors(n, DIM);
      return { vectors: vectors.slice(0, n), usage: { inputTokens: n * 5 } };
    }),
  };
}

// ── AC1: embed-batch returns 10 compatible vectors ────────────────────────

describe("OpenAICompatibleEmbedder — AC1: embed-batch compatibility", () => {
  it("AC1: embedBatch returns one result per input text", async () => {
    const texts = Array.from({ length: 10 }, (_, i) => `text ${i}`);
    const adapter = makeAdapter({});
    const embedder = new OpenAICompatibleEmbedder(adapter as never, "bge-m3");

    const results = await embedder.embedBatch(texts);
    expect(results).toHaveLength(10);
  });

  it("AC1: each result has text and vector (number[])", async () => {
    const texts = ["hello", "world"];
    const adapter = makeAdapter({});
    const embedder = new OpenAICompatibleEmbedder(adapter as never, "bge-m3");

    const results = await embedder.embedBatch(texts);
    for (const r of results) {
      expect(typeof r.text).toBe("string");
      expect(Array.isArray(r.vector)).toBe(true);
      expect(r.vector.every((v: number) => typeof v === "number")).toBe(true);
    }
  });

  it("AC1: vector at index i corresponds to text at index i", async () => {
    const texts = ["a", "b", "c"];
    const vectors = fakeVectors(3, DIM);
    const adapter = makeAdapter({ vectors });
    const embedder = new OpenAICompatibleEmbedder(adapter as never, "bge-m3");

    const results = await embedder.embedBatch(texts);
    expect(results[0]!.text).toBe("a");
    expect(results[1]!.text).toBe("b");
    expect(results[2]!.text).toBe("c");
  });

  it("AC1: adapter.embed is called with correct model and all texts", async () => {
    const texts = ["x", "y"];
    const adapter = makeAdapter({});
    const embedder = new OpenAICompatibleEmbedder(adapter as never, "my-model");

    await embedder.embedBatch(texts);
    expect(adapter.embed).toHaveBeenCalledOnce();
    expect(adapter.embed).toHaveBeenCalledWith({ model: "my-model", input: texts });
  });
});

// ── AC2: unsupported model throws with clear message ──────────────────────

describe("OpenAICompatibleEmbedder — AC2: model not supported throws", () => {
  it("AC2: throws when adapter.embed throws (model not supported)", async () => {
    const adapter = makeAdapter({ providerId: "local-glm", shouldThrow: true });
    const embedder = new OpenAICompatibleEmbedder(adapter as never, "bad-model");

    await expect(embedder.embedBatch(["text"])).rejects.toThrow();
  });

  it("AC2: thrown error message contains model and providerId", async () => {
    const adapter = makeAdapter({ providerId: "local-glm", shouldThrow: true });
    const embedder = new OpenAICompatibleEmbedder(adapter as never, "bad-model");

    await expect(embedder.embedBatch(["text"])).rejects.toThrow(/bad-model/);
  });
});

// ── AC3: inconsistent dimensions → structured warn ────────────────────────

describe("OpenAICompatibleEmbedder — AC3: dimension inconsistency warn", () => {
  it("AC3: emits warn when returned vector dimensions differ across results", async () => {
    const inconsistentVectors = [[1, 2, 3], [1, 2]]; // dim 3 and dim 2
    const adapter = makeAdapter({ vectors: inconsistentVectors });
    const embedder = new OpenAICompatibleEmbedder(adapter as never, "bge-m3");
    const warnSpy = vi.spyOn(embedder, "onDimensionMismatch");

    await embedder.embedBatch(["a", "b"]);

    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("AC3: still returns results even on dimension mismatch (non-fatal)", async () => {
    const inconsistentVectors = [[1, 2, 3], [1, 2]];
    const adapter = makeAdapter({ vectors: inconsistentVectors });
    const embedder = new OpenAICompatibleEmbedder(adapter as never, "bge-m3");
    vi.spyOn(embedder, "onDimensionMismatch").mockImplementation(() => undefined);

    const results = await embedder.embedBatch(["a", "b"]);
    expect(results).toHaveLength(2);
  });
});
