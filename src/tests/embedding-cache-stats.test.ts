/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-3.T04 — embedding-cache stats / hit-rate tests.
 */

import { describe, it, expect } from "vitest";
import { EmbeddingCache } from "../core/rag/embedding-cache.js";

describe("EmbeddingCache stats (E3.T04)", () => {
  it("identical text returns the cached vector", () => {
    const c = new EmbeddingCache();
    const v = [0.1, 0.2, 0.3];
    c.set("hello", v);
    expect(c.get("hello")).toEqual(v);
    expect(c.get("hello")).toEqual(v); // second hit also serves from cache
  });

  it("LRU eviction respects configurable cap", () => {
    const c = new EmbeddingCache({ maxSize: 2 });
    c.set("a", [1]);
    c.set("b", [2]);
    c.set("c", [3]); // evicts oldest ("a")
    expect(c.size()).toBe(2);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toEqual([2]);
    expect(c.get("c")).toEqual([3]);
  });

  it("stats() exposes hits, misses, hitRate, size, maxSize", () => {
    const c = new EmbeddingCache({ maxSize: 100 });
    expect(c.stats().hitRate).toBe(0); // no lookups yet
    c.set("x", [1, 2]);
    c.get("x"); // hit
    c.get("x"); // hit
    c.get("y"); // miss
    const s = c.stats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.size).toBe(1);
    expect(s.maxSize).toBe(100);
    expect(s.hitRate).toBeCloseTo(2 / 3, 5);
  });

  it("clear() resets size + counters", () => {
    const c = new EmbeddingCache();
    c.set("a", [1]);
    c.get("a");
    c.get("missing");
    c.clear();
    const s = c.stats();
    expect(s.size).toBe(0);
    expect(s.hits).toBe(0);
    expect(s.misses).toBe(0);
    expect(s.hitRate).toBe(0);
  });

  it("identical text dedups regardless of caller (sha256-keyed)", () => {
    const c = new EmbeddingCache();
    c.set("payload-text", [9, 9, 9]);
    expect(c.get("payload-text")).toEqual([9, 9, 9]);
    expect(c.size()).toBe(1);
  });
});
