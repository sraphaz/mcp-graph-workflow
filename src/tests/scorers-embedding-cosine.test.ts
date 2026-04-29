/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset (E18.T05).
 * Tests for embedding-cosine scorer using a fake provider (no ONNX runtime).
 */

import { describe, it, expect } from "vitest";
import { embeddingCosineScorer } from "../core/evals/scorers/embedding-cosine.js";
import type { EmbeddingProvider } from "../core/rag/onnx-embeddings.js";

/** L2-normalized fake provider — maps text to a deterministic 4-D vector. */
function fakeProvider(): EmbeddingProvider {
  const map = new Map<string, number[]>([
    ["a", [1, 0, 0, 0]],
    ["a-similar", [0.9, 0.1, 0, 0]],
    ["b", [0, 1, 0, 0]],
  ]);
  function normalize(v: number[]): number[] {
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / n);
  }
  return {
    name: "fake",
    dimensions: 4,
    async generateEmbedding(text: string): Promise<number[]> {
      const v = map.get(text) ?? [0, 0, 0, 1];
      return normalize(v);
    },
    async generateBatch(texts: string[]): Promise<number[][]> {
      return Promise.all(texts.map((t) => this.generateEmbedding(t)));
    },
  };
}

describe("embeddingCosineScorer (E18.T05)", () => {
  it("kind = 'embedding-cosine'", () => {
    expect(embeddingCosineScorer.kind).toBe("embedding-cosine");
  });

  it("returns score=1 + passed=true for identical text", async () => {
    const r = await embeddingCosineScorer.score({
      output: "a",
      expected: "a",
      provider: fakeProvider(),
    });
    expect(r.score).toBeCloseTo(1, 4);
    expect(r.passed).toBe(true);
  });

  it("returns high score for similar text and passes default threshold (0.8)", async () => {
    const r = await embeddingCosineScorer.score({
      output: "a",
      expected: "a-similar",
      provider: fakeProvider(),
    });
    expect(r.score).toBeGreaterThan(0.85);
    expect(r.passed).toBe(true);
  });

  it("returns low score for orthogonal text and fails default threshold", async () => {
    const r = await embeddingCosineScorer.score({
      output: "a",
      expected: "b",
      provider: fakeProvider(),
    });
    expect(r.score).toBeLessThan(0.5);
    expect(r.passed).toBe(false);
  });

  it("respects custom threshold", async () => {
    const r = await embeddingCosineScorer.score({
      output: "a",
      expected: "b",
      provider: fakeProvider(),
      threshold: 0,
    });
    expect(r.passed).toBe(true);
  });

  it("clamps cosine similarity to [0,1] (no negative scores)", async () => {
    // Provider where opposite vectors give cosine = -1 → clamped to 0.
    const provider: EmbeddingProvider = {
      name: "opp",
      dimensions: 2,
      async generateEmbedding(text: string): Promise<number[]> {
        return text === "x" ? [1, 0] : [-1, 0];
      },
      async generateBatch(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map((t) => this.generateEmbedding(t)));
      },
    };
    const r = await embeddingCosineScorer.score({
      output: "x",
      expected: "y",
      provider,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });
});
