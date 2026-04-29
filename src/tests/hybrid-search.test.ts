/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  hybridSearch,
  mmrRerank,
  cosineScore,
  type HybridCandidate,
} from "../core/rag/hybrid-search.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<HybridCandidate>): HybridCandidate {
  return {
    id: "doc-1",
    text: "hello world",
    bm25Score: 0.5,
    semanticScore: null,
    vector: null,
    ...overrides,
  };
}

function uniformVec(dim: number, val = 1): number[] {
  return Array(dim).fill(val / Math.sqrt(dim));
}

// ── cosineScore ─────────────────────────────────────────────────────────────

describe("cosineScore", () => {
  it("returns 1.0 for identical vectors", () => {
    const v = [0.6, 0.8];
    expect(cosineScore(v, v)).toBeCloseTo(1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineScore([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for empty or mismatched vectors", () => {
    expect(cosineScore([], [])).toBe(0);
    expect(cosineScore([1, 2], [1, 2, 3])).toBe(0);
  });
});

// ── mmrRerank ───────────────────────────────────────────────────────────────

describe("mmrRerank", () => {
  it("returns top-k candidates by MMR score", () => {
    const candidates: HybridCandidate[] = [
      makeCandidate({ id: "a", bm25Score: 0.9, semanticScore: 0.9, vector: uniformVec(4, 0.9) }),
      makeCandidate({ id: "b", bm25Score: 0.8, semanticScore: 0.8, vector: uniformVec(4, 0.8) }),
      makeCandidate({ id: "c", bm25Score: 0.7, semanticScore: 0.7, vector: uniformVec(4, 0.3) }),
      makeCandidate({ id: "d", bm25Score: 0.6, semanticScore: 0.6, vector: uniformVec(4, 0.2) }),
    ];
    const results = mmrRerank(candidates, { k: 2, lambda: 0.7 });
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("a"); // highest relevance first
  });

  it("uses lambda=0.7 by default", () => {
    const candidates = [
      makeCandidate({ id: "x", bm25Score: 0.5, semanticScore: 0.5, vector: [1, 0] }),
      makeCandidate({ id: "y", bm25Score: 0.4, semanticScore: 0.4, vector: [0, 1] }),
    ];
    const results = mmrRerank(candidates);
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
  });

  it("each result includes mmrScore in breakdown", () => {
    const candidates = [
      makeCandidate({ id: "a", bm25Score: 0.8, semanticScore: 0.8, vector: [1, 0] }),
    ];
    const results = mmrRerank(candidates, { k: 1 });
    expect(results[0].mmrScore).toBeDefined();
    expect(typeof results[0].mmrScore).toBe("number");
  });
});

// ── hybridSearch ─────────────────────────────────────────────────────────────

describe("hybridSearch — score breakdown", () => {
  it("returns results with bm25Score, semanticScore, combinedScore, mmrScore fields", () => {
    const candidates: HybridCandidate[] = [
      makeCandidate({ id: "doc1", bm25Score: 0.9, semanticScore: 0.8, vector: [0.6, 0.8] }),
      makeCandidate({ id: "doc2", bm25Score: 0.5, semanticScore: 0.6, vector: [0.8, 0.6] }),
    ];
    const results = hybridSearch(candidates, [0.6, 0.8]);
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(typeof r.bm25Score).toBe("number");
    expect(typeof r.combinedScore).toBe("number");
    expect(typeof r.mmrScore).toBe("number");
  });

  it("falls back to BM25 only when vector dim is missing (semanticScore: null)", () => {
    const candidates: HybridCandidate[] = [
      makeCandidate({ id: "no-vec-1", bm25Score: 0.9, semanticScore: null, vector: null }),
      makeCandidate({ id: "no-vec-2", bm25Score: 0.5, semanticScore: null, vector: null }),
    ];
    const results = hybridSearch(candidates, null);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("no-vec-1"); // sorted by bm25Score
    // semanticScore stays null in breakdown
    expect(results[0].semanticScore).toBeNull();
  });

  it("respects k option — returns at most k results", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({ id: `doc${i}`, bm25Score: i / 10, semanticScore: i / 10, vector: [i / 10, 1 - i / 10] }),
    );
    const results = hybridSearch(candidates, [0.5, 0.5], { k: 3 });
    expect(results).toHaveLength(3);
  });

  it("lambda is tunable — higher lambda gives more weight to relevance", () => {
    const candidates: HybridCandidate[] = [
      makeCandidate({ id: "a", bm25Score: 0.9, semanticScore: 0.9, vector: [1, 0] }),
      makeCandidate({ id: "b", bm25Score: 0.3, semanticScore: 0.3, vector: [0, 1] }),
    ];
    const highLambda = hybridSearch(candidates, [1, 0], { lambda: 0.9, k: 2 });
    expect(highLambda[0].id).toBe("a"); // most relevant wins
  });
});
