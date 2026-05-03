/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ToolCache, type CachedToolResult } from "../core/economy/cache/tool-cache.js";
import { GraphEventBus } from "../core/events/event-bus.js";

const okResult = (text: string): CachedToolResult => ({
  content: [{ type: "text", text }],
});

describe("ToolCache", () => {
  let cache: ToolCache;

  beforeEach(() => {
    cache = new ToolCache({ ttlMs: 1000, maxEntries: 50 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for tools outside the allowlist", () => {
    cache.set("node", { id: "n1" }, okResult("ignored"));
    expect(cache.get("node", { id: "n1" })).toBeUndefined();
  });

  it("returns the same result on a hit for cacheable tools", () => {
    const args = { id: "task-1" };
    cache.set("show", args, okResult("shown"));
    const hit = cache.get("show", args);
    expect(hit).toBeDefined();
    expect(hit?.content[0]?.text).toBe("shown");
  });

  it("differs by args — same tool, different args, separate entries", () => {
    cache.set("show", { id: "a" }, okResult("A"));
    cache.set("show", { id: "b" }, okResult("B"));
    expect(cache.get("show", { id: "a" })?.content[0]?.text).toBe("A");
    expect(cache.get("show", { id: "b" })?.content[0]?.text).toBe("B");
  });

  it("normalizes argument key order — equal args map to the same key", () => {
    cache.set("show", { a: 1, b: 2 }, okResult("v"));
    expect(cache.get("show", { b: 2, a: 1 })?.content[0]?.text).toBe("v");
  });

  it("does not cache error results", () => {
    cache.set("show", { id: "x" }, { content: [{ type: "text", text: "boom" }], isError: true });
    expect(cache.get("show", { id: "x" })).toBeUndefined();
  });

  it("misses after the TTL has elapsed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
    cache.set("show", { id: "ttl" }, okResult("fresh"));
    expect(cache.get("show", { id: "ttl" })?.content[0]?.text).toBe("fresh");
    vi.advanceTimersByTime(1500);
    expect(cache.get("show", { id: "ttl" })).toBeUndefined();
  });

  it("clears every entry on graph mutation events", () => {
    const bus = new GraphEventBus();
    cache.attachEventBus(bus);

    cache.set("show", { id: "1" }, okResult("v"));
    cache.set("metrics", { range: "all" }, okResult("m"));
    expect(cache.getStats().size).toBe(2);

    bus.emitTyped("node:updated", { nodeId: "n1", fields: ["status"] });

    expect(cache.getStats().size).toBe(0);
    expect(cache.get("show", { id: "1" })).toBeUndefined();
    expect(cache.getStats().invalidations).toBe(1);
  });

  it("attachEventBus is idempotent — re-attaching same bus does not double-register", () => {
    const bus = new GraphEventBus();
    cache.attachEventBus(bus);
    cache.attachEventBus(bus);

    cache.set("show", { id: "1" }, okResult("v"));
    bus.emitTyped("edge:created", { edgeId: "e1", from: "a", to: "b", relationType: "depends_on" });

    expect(cache.getStats().invalidations).toBe(1);
  });

  it("tracks hits and misses in stats", () => {
    cache.set("show", { id: "1" }, okResult("v"));
    cache.get("show", { id: "1" });   // hit
    cache.get("show", { id: "1" });   // hit
    cache.get("show", { id: "missing" }); // miss
    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
  });
});
