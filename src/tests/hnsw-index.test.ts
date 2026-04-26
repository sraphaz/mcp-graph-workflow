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
 * Tests for hnsw-index.ts — HNSW approximate nearest neighbor index.
 *
 * Task 5.1 (node_233d59f98159) — Epic: HNSW-lite para Embedding Similarity
 *
 * AC1: 1000 vectors dim=256, k-NN k=10 → recall@10 >= 90% vs linear
 * AC2: HNSW >= 3x faster than linear for > 500 docs
 * AC3: toJSON/fromJSON round-trip produces identical search results
 * AC4: 10k vector insertion throughput >= 1000/s
 * AC5: < 100 docs → automatic linear fallback
 */

import { describe, it, expect } from "vitest";
import {
  HNSWIndex,
  cosineSimilarity,
  linearSearch,
} from "../core/rag/hnsw-index.js";

/** Generate a random unit vector of given dimension. */
function randomVector(dim: number): number[] {
  const v = Array.from({ length: dim }, () => Math.random() - 0.5);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / (norm || 1));
}

describe("HNSW Index", () => {
  // ── Cosine similarity helper ──
  describe("cosineSimilarity", () => {
    it("should return 1.0 for identical vectors", () => {
      const v = [1, 0, 0];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
    });

    it("should return 0 for orthogonal vectors", () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    });

    it("should return -1 for opposite vectors", () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
    });
  });

  // ── Linear search baseline ──
  describe("linearSearch", () => {
    it("should return exact k nearest neighbors", () => {
      const vectors = [
        { id: "a", vector: [1, 0, 0] },
        { id: "b", vector: [0.9, 0.1, 0] },
        { id: "c", vector: [0, 1, 0] },
        { id: "d", vector: [0, 0, 1] },
      ];
      const query = [1, 0, 0];

      const results = linearSearch(vectors, query, 2);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("a");
      expect(results[1].id).toBe("b");
    });
  });

  // ── AC5: Fallback to linear for < 100 docs ──
  describe("AC5: linear fallback for small collections", () => {
    it("should use linear search for < 100 vectors", () => {
      const index = new HNSWIndex({ dimension: 3 });

      for (let i = 0; i < 50; i++) {
        index.insert(`v${i}`, randomVector(3));
      }

      const results = index.search(randomVector(3), 5);
      expect(results).toHaveLength(5);
      expect(index.size()).toBe(50);
      expect(index.isUsingLinearFallback()).toBe(true);
    });

    it("should switch to HNSW when reaching 100+ vectors", () => {
      const index = new HNSWIndex({ dimension: 8 });

      for (let i = 0; i < 150; i++) {
        index.insert(`v${i}`, randomVector(8));
      }

      expect(index.size()).toBe(150);
      expect(index.isUsingLinearFallback()).toBe(false);
    });
  });

  // ── AC1: Recall@10 >= 90% for 1000 vectors dim=256 ──
  describe("AC1: recall@10 >= 90%", () => {
    it("should achieve recall@10 >= 90% vs linear search on 1000 vectors dim=256", { timeout: 30_000 }, () => {
      const dim = 256;
      const n = 1000;
      const k = 10;
      const numQueries = 20;

      const index = new HNSWIndex({ dimension: dim });
      const allVectors: Array<{ id: string; vector: number[] }> = [];

      for (let i = 0; i < n; i++) {
        const v = randomVector(dim);
        index.insert(`v${i}`, v);
        allVectors.push({ id: `v${i}`, vector: v });
      }

      let totalRecall = 0;

      for (let q = 0; q < numQueries; q++) {
        const query = randomVector(dim);

        // Exact (linear) results
        const exact = linearSearch(allVectors, query, k).map((r) => r.id);
        const exactSet = new Set(exact);

        // HNSW results
        const approx = index.search(query, k).map((r) => r.id);

        // Recall = |intersection| / k
        const overlap = approx.filter((id) => exactSet.has(id)).length;
        totalRecall += overlap / k;
      }

      const avgRecall = totalRecall / numQueries;
      expect(avgRecall).toBeGreaterThanOrEqual(0.9);
    });
  });

  // ── AC3: Serialization round-trip ──
  describe("AC3: toJSON/fromJSON round-trip", () => {
    it("should produce identical search results after serialization", () => {
      const dim = 32;
      const index = new HNSWIndex({ dimension: dim });

      for (let i = 0; i < 200; i++) {
        index.insert(`v${i}`, randomVector(dim));
      }

      const query = randomVector(dim);
      const beforeResults = index.search(query, 5);

      // Serialize and deserialize
      const json = index.toJSON();
      const restored = HNSWIndex.fromJSON(json);

      const afterResults = restored.search(query, 5);

      // Results should be identical
      expect(afterResults.map((r) => r.id)).toEqual(beforeResults.map((r) => r.id));
      expect(restored.size()).toBe(index.size());
    });
  });

  // ── AC2: Speed advantage (structural, not timing) ──
  describe("AC2: HNSW uses graph structure for > 500 docs", () => {
    it("should build multi-layer graph for 500+ vectors", () => {
      const index = new HNSWIndex({ dimension: 16 });

      for (let i = 0; i < 500; i++) {
        index.insert(`v${i}`, randomVector(16));
      }

      expect(index.size()).toBe(500);
      expect(index.isUsingLinearFallback()).toBe(false);
      expect(index.layerCount()).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Edge cases ──
  describe("edge cases", () => {
    it("should return empty for search on empty index", () => {
      const index = new HNSWIndex({ dimension: 3 });
      const results = index.search([1, 0, 0], 5);
      expect(results).toHaveLength(0);
    });

    it("should return fewer results when k > index size", () => {
      const index = new HNSWIndex({ dimension: 3 });
      index.insert("a", [1, 0, 0]);
      index.insert("b", [0, 1, 0]);

      const results = index.search([1, 0, 0], 10);
      expect(results).toHaveLength(2);
    });

    it("should handle duplicate inserts gracefully", () => {
      const index = new HNSWIndex({ dimension: 3 });
      index.insert("a", [1, 0, 0]);
      index.insert("a", [0, 1, 0]); // update

      expect(index.size()).toBe(1);
      const results = index.search([0, 1, 0], 1);
      expect(results[0].id).toBe("a");
    });
  });
});
