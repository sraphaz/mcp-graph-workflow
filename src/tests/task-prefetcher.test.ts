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

import { describe, it, expect, beforeEach } from "vitest";
import {
  TaskPrefetcher,
} from "../core/planner/task-prefetcher.js";

describe("TaskPrefetcher — CPU Pipeline Prefetching for Tasks", () => {
  let prefetcher: TaskPrefetcher;

  beforeEach(() => {
    prefetcher = new TaskPrefetcher({ ttlMs: 5 * 60 * 1000 });
  });

  it("should store prefetched context for a predicted next task", () => {
    prefetcher.prefetch("node-b", { query: "test query", context: "pre-computed context" });

    const hit = prefetcher.get("node-b");
    expect(hit).not.toBeNull();
    expect(hit!.context).toBe("pre-computed context");
  });

  it("should return null for non-prefetched tasks", () => {
    const hit = prefetcher.get("node-unknown");
    expect(hit).toBeNull();
  });

  it("should invalidate on manual override (different task requested)", () => {
    prefetcher.prefetch("node-b", { query: "q1", context: "ctx1" });

    // User manually requests node-c instead of predicted node-b
    prefetcher.invalidateIfMismatch("node-c");

    const hit = prefetcher.get("node-b");
    expect(hit).toBeNull();
  });

  it("should NOT invalidate when requested task matches prefetch", () => {
    prefetcher.prefetch("node-b", { query: "q1", context: "ctx1" });

    // User requests the predicted task — no invalidation
    prefetcher.invalidateIfMismatch("node-b");

    const hit = prefetcher.get("node-b");
    expect(hit).not.toBeNull();
  });

  it("should expire entries after TTL", () => {
    const shortTtl = new TaskPrefetcher({ ttlMs: 1 }); // 1ms TTL
    shortTtl.prefetch("node-x", { query: "q", context: "ctx" });

    // Wait for TTL to expire
    const start = Date.now();
    while (Date.now() - start < 5) { /* busy wait 5ms */ }

    const hit = shortTtl.get("node-x");
    expect(hit).toBeNull();
  });

  it("should report stats with hit/miss counts", () => {
    prefetcher.prefetch("node-a", { query: "q", context: "ctx" });

    prefetcher.get("node-a"); // hit
    prefetcher.get("node-b"); // miss

    const stats = prefetcher.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it("should clear all entries", () => {
    prefetcher.prefetch("node-a", { query: "q1", context: "c1" });
    prefetcher.prefetch("node-b", { query: "q2", context: "c2" });

    prefetcher.clear();

    expect(prefetcher.getStats().size).toBe(0);
  });
});
