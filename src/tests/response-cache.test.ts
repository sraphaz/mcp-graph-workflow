/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T04 — response-cache tests.
 */

import { describe, it, expect } from "vitest";
import {
  ResponseCache,
  createMemoryPersistence,
  hashKey,
  DEFAULT_LRU_CAPACITY,
  DEFAULT_TTL_MS,
} from "../core/llm/response-cache.js";

describe("response-cache (E6.T04)", () => {
  it("constants: capacity=256, ttl=1h", () => {
    expect(DEFAULT_LRU_CAPACITY).toBe(256);
    expect(DEFAULT_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("hashKey is stable + non-empty for non-empty input", () => {
    expect(hashKey("hello")).toBe(hashKey("hello"));
    expect(hashKey("a")).not.toBe(hashKey("b"));
    expect(hashKey("x").length).toBe(8);
  });

  it("set/get round-trips a value via in-memory LRU", () => {
    const cache = new ResponseCache<string>({ schemaVersion: 1 });
    cache.set("k1", "v1");
    expect(cache.get("k1")).toBe("v1");
  });

  it("expired entries are not returned", () => {
    let now = 0;
    const cache = new ResponseCache<string>({
      schemaVersion: 1,
      ttlMs: 100,
      now: () => now,
    });
    cache.set("k", "v");
    now = 50;
    expect(cache.get("k")).toBe("v");
    now = 200;
    expect(cache.get("k")).toBeUndefined();
  });

  it("LRU evicts oldest when capacity exceeded", () => {
    const cache = new ResponseCache<string>({ schemaVersion: 1, capacity: 2 });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3"); // evicts 'a'
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
  });

  it("recent get() refreshes LRU position", () => {
    const cache = new ResponseCache<string>({ schemaVersion: 1, capacity: 2 });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.get("a"); // a becomes most recent
    cache.set("c", "3"); // evicts 'b'
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("1");
  });

  it("integrates persistence: hit on warm restart from store", () => {
    const persistence = createMemoryPersistence<string>();
    const cache1 = new ResponseCache<string>({ schemaVersion: 1, persistence });
    cache1.set("k", "persisted");

    const cache2 = new ResponseCache<string>({ schemaVersion: 1, persistence });
    expect(cache2.get("k")).toBe("persisted");
  });

  it("schema bump invalidates entries on read", () => {
    const persistence = createMemoryPersistence<string>();
    const v1 = new ResponseCache<string>({ schemaVersion: 1, persistence });
    v1.set("k", "old");
    expect(v1.get("k")).toBe("old");

    const v2 = new ResponseCache<string>({ schemaVersion: 2, persistence });
    expect(v2.get("k")).toBeUndefined();
  });

  it("invalidateOnSchemaBump returns count of dropped persisted entries", () => {
    const persistence = createMemoryPersistence<string>();
    const v1 = new ResponseCache<string>({ schemaVersion: 1, persistence });
    v1.set("a", "x");
    v1.set("b", "y");

    const v2 = new ResponseCache<string>({ schemaVersion: 2, persistence });
    expect(v2.invalidateOnSchemaBump()).toBe(2);
    expect(persistence.size()).toBe(0);
  });

  it("invalidateAll clears LRU + persistence on the active schema", () => {
    const persistence = createMemoryPersistence<string>();
    const cache = new ResponseCache<string>({ schemaVersion: 5, persistence });
    cache.set("k", "v");
    cache.invalidateAll();
    expect(cache.get("k")).toBeUndefined();
    expect(persistence.size()).toBe(0);
  });

  it("expired persisted entry triggers prune", () => {
    let now = 0;
    const persistence = createMemoryPersistence<string>();
    const cache = new ResponseCache<string>({
      schemaVersion: 1,
      ttlMs: 100,
      persistence,
      now: () => now,
    });
    cache.set("k", "v");
    now = 1000;
    expect(cache.get("k")).toBeUndefined();
    expect(persistence.size()).toBe(0);
  });
});
