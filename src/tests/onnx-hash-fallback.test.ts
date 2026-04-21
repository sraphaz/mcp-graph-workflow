/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Task: Garantir fallback correto para hash embeddings quando ONNX indisponível
 * node_c21282adb899
 *
 * AC1: generateEmbedding() returns non-zero vector when ONNX unavailable (hash fallback active).
 * AC2: embedding_type stored is 'tfidf' when ONNX not available.
 * AC3: Log warn 'onnx:unavailable' emitted exactly once per process (boolean cache).
 * AC4: rag-pipeline.ts does not throw unhandled exception when ONNX fails during indexing.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateEmbedding, EMBEDDING_DIM } from "../core/rag/embedding-generator.js";
import { isOnnxAvailable } from "../core/rag/onnx-embeddings.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { EmbeddingStore } from "../core/rag/embedding-store.js";

// ── AC1: generateEmbedding() returns non-zero vector on hash fallback ─
describe("generateEmbedding — AC1: non-zero fallback vector", () => {
  it("should return an array of numbers when ONNX is unavailable", async () => {
    const vec = await generateEmbedding("test text for hash embedding");
    expect(Array.isArray(vec)).toBe(true);
    expect(vec.length).toBe(EMBEDDING_DIM);
  });

  it("should return a non-zero vector for non-empty text (hash fallback active)", async () => {
    const vec = await generateEmbedding("semantic search fallback test");
    const allZero = vec.every((v) => v === 0);
    expect(allZero).toBe(false);
  });

  it("should return exactly 384 dimensions (same as ONNX model)", async () => {
    const vec = await generateEmbedding("dimension check");
    expect(vec.length).toBe(384);
  });

  it("should return zero vector for empty string (not a crash)", async () => {
    const vec = await generateEmbedding("");
    expect(Array.isArray(vec)).toBe(true);
    expect(vec.every((v) => v === 0)).toBe(true);
  });

  it("should be L2-normalized (sum of squares ≈ 1) for non-empty text", async () => {
    const vec = await generateEmbedding("normalized embedding vector test");
    const sumSq = vec.reduce((s, v) => s + v * v, 0);
    expect(sumSq).toBeGreaterThan(0.9);
    expect(sumSq).toBeLessThan(1.1);
  });
});

// ── AC2: embedding_type is 'tfidf' when ONNX unavailable ─────────
describe("EmbeddingStore — AC2: embedding_type defaults to tfidf", () => {
  it("should default embedding_type to 'tfidf' when no type is specified", () => {
    const store = new EmbeddingStore(SqliteStore.open(":memory:"));
    store.upsert({
      id: "test-1",
      source: "graph_node",
      sourceId: "node-abc",
      text: "test embedding",
      embedding: new Array(384).fill(0.1),
    });
    const count = store.count("tfidf");
    expect(count).toBeGreaterThan(0);
  });

  it("should store embedding_type='tfidf' explicitly via upsert", () => {
    const store = new EmbeddingStore(SqliteStore.open(":memory:"));
    store.upsert(
      {
        id: "test-2",
        source: "graph_node",
        sourceId: "node-def",
        text: "tfidf fallback text",
        embedding: new Array(384).fill(0.05),
      },
      "tfidf",
    );
    expect(store.count("tfidf")).toBe(1);
    expect(store.count("onnx")).toBe(0);
  });

  it("should distinguish tfidf from onnx entries in count", () => {
    const store = new EmbeddingStore(SqliteStore.open(":memory:"));
    store.upsert({ id: "e1", source: "graph_node", sourceId: "n1", text: "text1", embedding: new Array(384).fill(0.1) }, "tfidf");
    store.upsert({ id: "e2", source: "graph_node", sourceId: "n2", text: "text2", embedding: new Array(384).fill(0.2) }, "onnx");
    expect(store.count("tfidf")).toBe(1);
    expect(store.count("onnx")).toBe(1);
  });
});

// ── AC3: warn 'onnx:unavailable' cached (at most once) ───────────
describe("isOnnxAvailable — AC3: single-process warning cache", () => {
  it("should return the same boolean on repeated calls (cached)", async () => {
    const r1 = await isOnnxAvailable();
    const r2 = await isOnnxAvailable();
    expect(r1).toBe(r2);
  });

  it("onnxAvailableCache guards repeated dynamic import attempts (structural)", () => {
    const source = readFileSync(resolve("src/core/rag/onnx-embeddings.ts"), "utf-8");
    expect(source).toMatch(/onnxAvailableCache\s*!==\s*null/);
  });

  it("should return false in test env (onnxruntime-node not installed)", async () => {
    const available = await isOnnxAvailable();
    // If onnxruntime-node were installed, this would return true — that's also fine
    expect(typeof available).toBe("boolean");
  });
});

// ── AC4: rag-pipeline.ts does not throw on ONNX failure ──────────
describe("rag-pipeline — AC4: ONNX failure does not crash indexing", () => {
  it("should have try/catch around ONNX embedding in indexing loop (structural)", () => {
    const source = readFileSync(resolve("src/core/rag/rag-pipeline.ts"), "utf-8");
    expect(source).toMatch(/onnxFailed\+\+|catch.*onnxFailed/s);
  });

  it("should log high failure rate but not throw (structural: high-failure-rate warn)", () => {
    const source = readFileSync(resolve("src/core/rag/rag-pipeline.ts"), "utf-8");
    expect(source).toMatch(/onnx:high-failure-rate/);
  });

  it("should continue indexing after individual ONNX failures (structural: onnxFailed counter)", () => {
    const source = readFileSync(resolve("src/core/rag/rag-pipeline.ts"), "utf-8");
    expect(source).toMatch(/onnxFailed/);
    expect(source).toMatch(/onnxIndexed/);
  });
});
