/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * E3.T07 — Backwards-compat regression: lexical mode must be untouched.
 *
 * Verifies that:
 * 1. Existing rag-trace interface shape is preserved
 * 2. parseRagHybridMode defaults to 'lexical' without env var
 * 3. New hybrid modules import independently (no ONNX required for lexical)
 * 4. embedding-store schema changes don't break existing insert/findSimilar
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { EmbeddingStore } from "../core/rag/embedding-store.js";
import { RagTracer, type RagTrace } from "../core/rag/rag-trace.js";
import { parseRagHybridMode, requiresEmbeddings } from "../core/rag/rag-hybrid-mode.js";
import { hybridSearch, cosineScore } from "../core/rag/hybrid-search.js";

// ── AC3: No new deps required for lexical mode ─────────────────────────────

describe("lexical mode — no ONNX dep required", () => {
  it("parseRagHybridMode defaults to lexical with empty env", () => {
    expect(parseRagHybridMode({})).toBe("lexical");
  });

  it("requiresEmbeddings returns false for lexical mode", () => {
    expect(requiresEmbeddings("lexical")).toBe(false);
  });

  it("hybridSearch BM25 fallback works without any vectors (no ONNX)", () => {
    const candidates = [
      { id: "a", text: "hello", bm25Score: 0.9, semanticScore: null, vector: null },
      { id: "b", text: "world", bm25Score: 0.5, semanticScore: null, vector: null },
    ];
    const results = hybridSearch(candidates, null, { k: 2 });
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("a");
  });
});

// ── AC2: rag-trace shape unchanged ─────────────────────────────────────────

describe("rag-trace — shape unchanged in lexical mode", () => {
  it("RagTrace interface has expected fields", () => {
    const tracer = new RagTracer("regression test");
    const trace: RagTrace = tracer.finalize();

    expect(trace).toHaveProperty("traceId");
    expect(trace).toHaveProperty("query");
    expect(trace).toHaveProperty("timestamp");
    expect(trace).toHaveProperty("stages");
    expect(trace).toHaveProperty("totalLatencyMs");
    expect(trace).toHaveProperty("totalTokensUsed");
    expect(trace).toHaveProperty("sourcesContributed");
    expect(trace).toHaveProperty("citationCount");
  });

  it("trace stages array is empty initially", () => {
    const tracer = new RagTracer("test query");
    expect(tracer.finalize().stages).toEqual([]);
  });
});

// ── AC1: EmbeddingStore schema changes don't break existing lexical ops ─────

describe("embedding-store — lexical ops unaffected by v67 migration", () => {
  let store: SqliteStore;
  let embeddingStore: EmbeddingStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("regression-test");
    embeddingStore = new EmbeddingStore(store);
  });

  afterEach(() => {
    store.close();
  });

  it("can upsert with old fields (no embedding_blob/vector_dim)", () => {
    const entry = {
      id: "doc-1",
      source: "knowledge" as const,
      sourceId: "k1",
      text: "hello world",
      embedding: Buffer.from(new Float32Array([0.1, 0.2, 0.3]).buffer),
    };
    expect(() => embeddingStore.upsert(entry, "tfidf")).not.toThrow();
  });

  it("findSimilar still returns results in lexical mode", () => {
    const vec = [0.6, 0.8];
    embeddingStore.upsert({
      id: "doc-1", source: "knowledge", sourceId: "k1",
      text: "hello", embedding: Buffer.from(new Float32Array(vec).buffer),
    }, "tfidf");

    const results = embeddingStore.findSimilar(vec, 5);
    expect(results.length).toBeGreaterThan(0);
  });

  it("count() still works after migration", () => {
    expect(embeddingStore.count()).toBe(0);
    embeddingStore.upsert({
      id: "doc-1", source: "knowledge", sourceId: "k1",
      text: "test", embedding: Buffer.from([1, 2, 3, 4]),
    });
    expect(embeddingStore.count()).toBe(1);
  });
});

// ── cosineScore purity — no side effects ───────────────────────────────────

describe("cosineScore — pure math, no external deps", () => {
  it("is deterministic — same input always returns same output", () => {
    const a = [0.3, 0.4, 0.5];
    const b = [0.1, 0.9, 0.2];
    const result1 = cosineScore(a, b);
    const result2 = cosineScore(a, b);
    expect(result1).toBe(result2);
  });
});
