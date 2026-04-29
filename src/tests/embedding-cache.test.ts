/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-17.T03 — embedding-cache LRU 10k entries, text-hash key
 */

import { describe, it, expect } from "vitest";
import { EmbeddingCache, hashTextKey } from "../core/rag/embedding-cache.js";

describe("hashTextKey", () => {
  it("returns a stable sha256 hex for the same text", () => {
    expect(hashTextKey("hello")).toBe(hashTextKey("hello"));
  });
  it("returns different keys for different text", () => {
    expect(hashTextKey("a")).not.toBe(hashTextKey("b"));
  });
  it("returns 64-char hex (sha256)", () => {
    const k = hashTextKey("anything");
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("EmbeddingCache", () => {
  it("stores and retrieves vectors by text key", () => {
    const cache = new EmbeddingCache({ maxSize: 100 });
    const v = [0.1, 0.2, 0.3];
    cache.set("hello world", v);
    expect(cache.get("hello world")).toEqual(v);
  });

  it("returns undefined for missing keys", () => {
    const cache = new EmbeddingCache({ maxSize: 100 });
    expect(cache.get("missing")).toBeUndefined();
  });

  it("evicts least-recently-used when over maxSize", () => {
    const cache = new EmbeddingCache({ maxSize: 2 });
    cache.set("a", [1]);
    cache.set("b", [2]);
    cache.set("c", [3]); // should evict 'a'
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toEqual([2]);
    expect(cache.get("c")).toEqual([3]);
  });

  it("get() updates recency — recently-accessed survives eviction", () => {
    const cache = new EmbeddingCache({ maxSize: 2 });
    cache.set("a", [1]);
    cache.set("b", [2]);
    cache.get("a"); // 'a' becomes most-recent
    cache.set("c", [3]); // should evict 'b' (least recent), not 'a'
    expect(cache.get("a")).toEqual([1]);
    expect(cache.get("b")).toBeUndefined();
  });

  it("default maxSize is 10000", () => {
    const cache = new EmbeddingCache();
    expect(cache.maxSize).toBe(10000);
  });

  it("size() reflects current entry count", () => {
    const cache = new EmbeddingCache({ maxSize: 10 });
    expect(cache.size()).toBe(0);
    cache.set("a", [1]);
    cache.set("b", [2]);
    expect(cache.size()).toBe(2);
  });

  it("clear() empties the cache", () => {
    const cache = new EmbeddingCache({ maxSize: 10 });
    cache.set("a", [1]);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("uses text-hash internally — same text returns same vector reference", () => {
    const cache = new EmbeddingCache({ maxSize: 10 });
    const v = [0.5];
    cache.set("query text", v);
    expect(cache.get("query text")).toBe(v);
  });
});
