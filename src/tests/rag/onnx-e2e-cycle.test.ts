/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * E2E cycle tests for ONNX embeddings.
 *
 * AC4: Tests skip automatically when onnxruntime-node is not installed.
 * Pure-math tests (meanPoolAndNormalize, findSimilar ordering) always run.
 * Tests that require the live ONNX model are guarded with it.skipIf.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { EmbeddingStore } from "../../core/rag/embedding-store.js";
import {
  meanPoolAndNormalize,
  isOnnxAvailable,
  getOnnxProvider,
} from "../../core/rag/onnx-embeddings.js";

// Resolved once for the entire suite — guards ONNX-dependent tests
let onnxAvailable = false;

beforeAll(async () => {
  onnxAvailable = await isOnnxAvailable();
});

// ── AC2 — meanPoolAndNormalize produces unit-norm vectors ────────────────────

describe("meanPoolAndNormalize()", () => {
  it("should return a vector of the requested dimension", () => {
    const dim = 4;
    const data = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]); // 2 tokens × 4 dims
    const result = meanPoolAndNormalize(data, 2, dim);
    expect(result).toHaveLength(dim);
  });

  it("should produce a unit-norm vector (L2 ≈ 1.0, tolerance 0.01)", () => {
    const dim = 4;
    // 2 tokens: [1,0,0,0] and [0,1,0,0]
    const data = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]);
    const result = meanPoolAndNormalize(data, 2, dim);

    const norm = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 2); // within 0.01
  });

  it("should return a zero vector when validTokens is 0", () => {
    const dim = 4;
    const data = new Float32Array(8).fill(1);
    const result = meanPoolAndNormalize(data, 0, dim);
    expect(result.every((v) => v === 0)).toBe(true);
  });

  it("should produce unit-norm for 384-dim vectors (realistic size)", () => {
    const dim = 384;
    const tokens = 8;
    // Random-ish data: each token has a different pattern
    const data = new Float32Array(tokens * dim);
    for (let t = 0; t < tokens; t++) {
      for (let d = 0; d < dim; d++) {
        data[t * dim + d] = Math.sin(t + d * 0.01);
      }
    }
    const result = meanPoolAndNormalize(data, tokens, dim);
    const norm = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 2);
  });
});

// ── AC3 — findSimilar returns results sorted by similarity descending ────────

describe("EmbeddingStore.findSimilar()", () => {
  function makeStore(): EmbeddingStore {
    const store = SqliteStore.open(":memory:");
    store.initProject("onnx-e2e-test");
    return new EmbeddingStore(store);
  }

  it("should return results ordered by similarity descending", () => {
    const es = makeStore();

    // query vector pointing in a known direction
    const query = [1, 0, 0, 0];

    // Insert entries at known angles to the query
    es.upsert({ id: "high",   source: "node", sourceId: "1", text: "high",   embedding: [0.9, 0.1, 0, 0] }, "onnx");
    es.upsert({ id: "medium", source: "node", sourceId: "2", text: "medium", embedding: [0.5, 0.5, 0, 0] }, "onnx");
    es.upsert({ id: "low",    source: "node", sourceId: "3", text: "low",    embedding: [0.1, 0.9, 0, 0] }, "onnx");

    const results = es.findSimilar(query, 10, "onnx");

    expect(results.length).toBe(3);
    // Similarity must be non-increasing
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
    }
  });

  it("should return the most similar result first", () => {
    const es = makeStore();
    const query = [1, 0, 0, 0];

    es.upsert({ id: "exact",  source: "node", sourceId: "a", text: "a", embedding: [1, 0, 0, 0] }, "onnx");
    es.upsert({ id: "off",    source: "node", sourceId: "b", text: "b", embedding: [0, 1, 0, 0] }, "onnx");

    const results = es.findSimilar(query, 10, "onnx");

    expect(results[0].id).toBe("exact");
    expect(results[0].similarity).toBeCloseTo(1.0, 4);
  });

  it("should respect the limit parameter", () => {
    const es = makeStore();
    const query = [1, 0];

    for (let i = 0; i < 10; i++) {
      es.upsert({ id: `e${i}`, source: "node", sourceId: `${i}`, text: `t${i}`, embedding: [i * 0.1, 0] }, "onnx");
    }

    const results = es.findSimilar(query, 3, "onnx");
    expect(results.length).toBe(3);
  });
});

// ── AC1 + AC4 — ONNX-dependent tests (skipped when runtime unavailable) ─────

describe("ONNX provider (skipped when onnxruntime-node not installed)", () => {
  it.skipIf(!onnxAvailable)(
    "should return a provider with 384-dimension embeddings",
    async () => {
      const provider = await getOnnxProvider(process.cwd() + "/workflow-graph/models");
      expect(provider).not.toBeNull();
      expect(provider!.dimensions).toBe(384);
    },
  );

  it.skipIf(!onnxAvailable)(
    "should generate an embedding of length 384 for a short text",
    async () => {
      const provider = await getOnnxProvider(process.cwd() + "/workflow-graph/models");
      const embedding = await provider!.generateEmbedding("hello world");
      expect(embedding).toHaveLength(384);
    },
  );

  it.skipIf(!onnxAvailable)(
    "generated embedding should have L2 norm ≈ 1.0",
    async () => {
      const provider = await getOnnxProvider(process.cwd() + "/workflow-graph/models");
      const embedding = await provider!.generateEmbedding("semantic search query");
      const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 1);
    },
  );

  it("should not fail CI when onnxruntime-node is not installed", async () => {
    // This test always runs: it verifies that isOnnxAvailable() resolves without throwing
    const result = await isOnnxAvailable();
    expect(typeof result).toBe("boolean");
  });
});
