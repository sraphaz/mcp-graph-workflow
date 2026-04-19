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

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SemanticCache,

} from "../core/rag/semantic-cache.js";

function makeEmbedding(values: number[]): number[] {
  return values;
}

describe("SemanticCache", () => {
  let cache: SemanticCache;

  beforeEach(() => {
    cache = new SemanticCache();
  });

  describe("set + getExact", () => {
    it("should return cached result for exact query match via MD5", () => {
      const embedding = makeEmbedding([1, 0, 0]);
      cache.set("what is TypeScript", embedding, { answer: "A typed JS superset" });

      const result = cache.getExact("what is TypeScript");

      expect(result).toEqual({ answer: "A typed JS superset" });
    });

    it("should return undefined for unknown query", () => {
      const result = cache.getExact("unknown query");
      expect(result).toBeUndefined();
    });

    it("should overwrite existing entry with same query", () => {
      const embedding = makeEmbedding([1, 0, 0]);
      cache.set("query1", embedding, { v: 1 });
      cache.set("query1", embedding, { v: 2 });

      expect(cache.getExact("query1")).toEqual({ v: 2 });
      expect(cache.stats().size).toBe(1);
    });
  });

  describe("getSimilar", () => {
    it("should return cached result when cosine similarity >= 0.85", () => {
      // Identical vectors → cosine = 1.0
      const embedding = makeEmbedding([1, 0, 0]);
      cache.set("original query", embedding, { matched: true });

      const result = cache.getSimilar(makeEmbedding([1, 0, 0]));

      expect(result).toEqual({ matched: true });
    });

    it("should return undefined when cosine similarity < 0.85", () => {
      // Orthogonal vectors → cosine = 0.0
      cache.set("query A", makeEmbedding([1, 0, 0]), { data: "A" });

      const result = cache.getSimilar(makeEmbedding([0, 1, 0]));

      expect(result).toBeUndefined();
    });

    it("should return the most similar entry above threshold", () => {
      cache.set("query1", makeEmbedding([1, 0, 0]), { best: false });
      cache.set("query2", makeEmbedding([0.9, 0.1, 0]), { best: true });

      // Closer to query2's embedding
      const result = cache.getSimilar(makeEmbedding([0.85, 0.15, 0]));

      expect(result).toEqual({ best: true });
    });

    it("should respect custom threshold", () => {
      cache.set("query", makeEmbedding([1, 0, 0]), { found: true });

      // With threshold 0.99, a moderately different vector misses
      const miss = cache.getSimilar(makeEmbedding([0.7, 0.7, 0]), 0.99);
      expect(miss).toBeUndefined();

      // With threshold 0.5, more relaxed — same vector hits
      const hit = cache.getSimilar(makeEmbedding([0.7, 0.7, 0]), 0.5);
      expect(hit).toEqual({ found: true });
    });
  });

  describe("TTL expiration", () => {
    it("should return undefined for expired entries on getExact", () => {
      const cache = new SemanticCache({ ttlMs: 100 });
      cache.set("query", makeEmbedding([1, 0, 0]), { data: "old" });

      // Simulate time passing by manipulating internal state
      vi.useFakeTimers();
      vi.advanceTimersByTime(150);

      expect(cache.getExact("query")).toBeUndefined();

      vi.useRealTimers();
    });

    it("should return undefined for expired entries on getSimilar", () => {
      const cache = new SemanticCache({ ttlMs: 100 });
      cache.set("query", makeEmbedding([1, 0, 0]), { data: "old" });

      vi.useFakeTimers();
      vi.advanceTimersByTime(150);

      expect(cache.getSimilar(makeEmbedding([1, 0, 0]))).toBeUndefined();

      vi.useRealTimers();
    });

    it("should return result for non-expired entries", () => {
      const cache = new SemanticCache({ ttlMs: 10000 });
      cache.set("query", makeEmbedding([1, 0, 0]), { data: "fresh" });

      expect(cache.getExact("query")).toEqual({ data: "fresh" });
    });
  });

  describe("eviction", () => {
    it("should evict oldest entry when exceeding maxEntries", () => {
      const cache = new SemanticCache({ maxEntries: 3 });

      cache.set("query1", makeEmbedding([1, 0, 0]), { n: 1 });
      cache.set("query2", makeEmbedding([0, 1, 0]), { n: 2 });
      cache.set("query3", makeEmbedding([0, 0, 1]), { n: 3 });
      // This should evict query1 (oldest)
      cache.set("query4", makeEmbedding([1, 1, 0]), { n: 4 });

      expect(cache.getExact("query1")).toBeUndefined();
      expect(cache.getExact("query2")).toEqual({ n: 2 });
      expect(cache.getExact("query4")).toEqual({ n: 4 });
      expect(cache.stats().size).toBe(3);
    });
  });

  describe("stats", () => {
    it("should track hits, misses, and size correctly", () => {
      cache.set("q1", makeEmbedding([1, 0, 0]), { data: 1 });

      // Hit
      cache.getExact("q1");
      // Miss
      cache.getExact("unknown");
      // Similar hit
      cache.getSimilar(makeEmbedding([1, 0, 0]));
      // Similar miss
      cache.getSimilar(makeEmbedding([0, 1, 0]));

      const stats = cache.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.size).toBe(1);
    });

    it("should start with zero stats", () => {
      const stats = cache.stats();
      expect(stats).toEqual({ hits: 0, misses: 0, size: 0 });
    });
  });

  describe("defaults", () => {
    it("should use 10 minute TTL by default", () => {
      const cache = new SemanticCache();
      cache.set("q", makeEmbedding([1, 0, 0]), { data: 1 });

      vi.useFakeTimers();
      // 9 minutes — still valid
      vi.advanceTimersByTime(9 * 60 * 1000);
      expect(cache.getExact("q")).toEqual({ data: 1 });

      // 2 more minutes (11 total) — expired
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(cache.getExact("q")).toBeUndefined();

      vi.useRealTimers();
    });

    it("should use 100 max entries by default", () => {
      const cache = new SemanticCache();
      for (let i = 0; i < 101; i++) {
        cache.set(`query-${i}`, makeEmbedding([i, 0, 0]), { n: i });
      }

      // First entry should be evicted
      expect(cache.getExact("query-0")).toBeUndefined();
      // Last entry should exist
      expect(cache.getExact("query-100")).toEqual({ n: 100 });
      expect(cache.stats().size).toBe(100);
    });
  });
});
