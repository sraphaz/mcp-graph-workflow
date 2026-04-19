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

import { describe, it, expect } from "vitest";
import {
  generateEmbedding,
  generateEmbeddingBatch,
  EMBEDDING_DIM,
} from "../core/rag/embedding-generator.js";

describe("Embedding generator", () => {
  it("returns a 384-dimensional array", async () => {
    const vec = await generateEmbedding("hello world");
    expect(vec).toHaveLength(384);
  });

  it("embedding is L2-normalized (norm ~1.0)", async () => {
    const vec = await generateEmbedding("test normalization");
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 1);
  });

  it("empty text returns zero vector", async () => {
    const vec = await generateEmbedding("");
    expect(vec).toHaveLength(384);
    expect(vec.every((v) => v === 0)).toBe(true);
  });

  it("long text is truncated without error", async () => {
    const longText = "word ".repeat(10_000);
    const vec = await generateEmbedding(longText);
    expect(vec).toHaveLength(384);
  });

  it("different texts produce different embeddings", async () => {
    const vec1 = await generateEmbedding("typescript programming");
    const vec2 = await generateEmbedding("cooking recipes for dinner");
    // At least some dimensions should differ
    const allSame = vec1.every((v, i) => v === vec2[i]);
    expect(allSame).toBe(false);
  });

  it("similar texts produce similar embeddings", async () => {
    const vec1 = await generateEmbedding("javascript testing framework");
    const vec2 = await generateEmbedding("javascript test framework");
    // Cosine similarity should be high
    const dot = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
    expect(dot).toBeGreaterThan(0.8);
  });

  it("batch processes multiple texts", async () => {
    const texts = ["hello", "world", "test"];
    const results = await generateEmbeddingBatch(texts);
    expect(results).toHaveLength(3);
    results.forEach((vec) => expect(vec).toHaveLength(384));
  });

  it("empty batch returns empty array", async () => {
    const results = await generateEmbeddingBatch([]);
    expect(results).toEqual([]);
  });

  it("batch with empty strings returns zeros for empties", async () => {
    const results = await generateEmbeddingBatch(["", "hello", ""]);
    expect(results).toHaveLength(3);
    expect(results[0].every((v) => v === 0)).toBe(true);
    expect(results[2].every((v) => v === 0)).toBe(true);
    // Non-empty should have non-zero values
    expect(results[1].some((v) => v !== 0)).toBe(true);
  });

  it("EMBEDDING_DIM is 384", () => {
    expect(EMBEDDING_DIM).toBe(384);
  });
});
