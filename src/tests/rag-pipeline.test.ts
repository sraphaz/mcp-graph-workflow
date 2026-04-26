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
 * Targeted tests for TfIdfVectorizer — the pure component of rag-pipeline.
 *
 * Integration tests in rag-semantic.test.ts and hybrid-rag-scoring.test.ts
 * exercise the vectorizer through full pipelines; this file isolates the
 * class to catch regressions before they propagate.
 */

import { describe, it, expect } from "vitest";
import { TfIdfVectorizer } from "../core/rag/rag-pipeline.js";

describe("TfIdfVectorizer", () => {
  it("should report vocabSize=0 before fit()", () => {
    const v = new TfIdfVectorizer();
    expect(v.vocabSize).toBe(0);
  });

  it("should fall back to hash embedding when not fitted", () => {
    const v = new TfIdfVectorizer();
    const embedding = v.embed("hello world");

    // hashEmbed produces a 128-dim vector.
    expect(embedding).toHaveLength(128);
    // L2-normalized fallback: norm is 0 or 1.
    const norm = Math.sqrt(embedding.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 1);
  });

  it("should produce identical fallback embeddings for the same input", () => {
    const v = new TfIdfVectorizer();
    const a = v.embed("the quick brown fox");
    const b = v.embed("the quick brown fox");
    expect(a).toEqual(b);
  });

  it("should produce different fallback embeddings for different inputs", () => {
    const v = new TfIdfVectorizer();
    const a = v.embed("the quick brown fox");
    const b = v.embed("a slow purple cat");
    expect(a).not.toEqual(b);
  });

  it("should populate vocab after fit() with non-empty docs", () => {
    const v = new TfIdfVectorizer();
    v.fit([
      ["the", "quick", "fox"],
      ["the", "lazy", "dog"],
      ["foxes", "and", "dogs"],
    ]);
    expect(v.vocabSize).toBeGreaterThan(0);
  });

  it("should produce deterministic embeddings after fit (same input → same output)", () => {
    const v = new TfIdfVectorizer();
    v.fit([
      ["api", "client", "code"],
      ["api", "server", "code"],
      ["client", "code", "test"],
    ]);

    const a = v.embed("api client code");
    const b = v.embed("api client code");
    expect(a).toEqual(b);
  });

  it("should produce a vector matching vocab dimensionality after fit", () => {
    const v = new TfIdfVectorizer();
    v.fit([
      ["a", "b", "c"],
      ["a", "d", "e"],
    ]);

    const embedding = v.embed("a b c");
    // Vocab covers a/b/c/d/e (5 unique terms); embedding should match.
    expect(embedding).toHaveLength(v.vocabSize);
  });

  it("should handle empty input text gracefully (no fitted vocab)", () => {
    const v = new TfIdfVectorizer();
    expect(() => v.embed("")).not.toThrow();
    const empty = v.embed("");
    expect(empty).toHaveLength(128); // fallback dim
  });

  it("should re-fit and replace vocabulary on subsequent calls", () => {
    const v = new TfIdfVectorizer();
    v.fit([["a", "b"]]);
    const sizeAfterFirst = v.vocabSize;

    v.fit([["x", "y", "z", "w"]]);
    const sizeAfterSecond = v.vocabSize;

    // Second fit should reflect the new vocab, not append to the first.
    expect(sizeAfterSecond).not.toBe(sizeAfterFirst);
    expect(sizeAfterSecond).toBeGreaterThan(0);
  });
});
