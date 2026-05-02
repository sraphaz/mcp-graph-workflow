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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { maybeRunMemoryDynamicsTick, MEMORY_DYNAMICS_TICK_KEY, DEFAULT_TICK_INTERVAL_MS } from "../core/rag/memory-dynamics-tick.js";

const BASE = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma";
const VARIANT = `${BASE} addendum`;

describe("maybeRunMemoryDynamicsTick — opportunistic auto-learning cadence", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("dynamics-tick-test");
  });

  afterEach(() => {
    store.close();
  });

  it("runs on first invocation when no last-tick timestamp exists", () => {
    const r = maybeRunMemoryDynamicsTick(store);
    expect(r.ran).toBe(true);
    expect(r.reason).toBe("ran");
    expect(typeof r.lastTickAt).toBe("string");
    expect(store.getProjectSetting(MEMORY_DYNAMICS_TICK_KEY)).toBe(r.lastTickAt);
  });

  it("rate-limits when invoked again immediately after a tick", () => {
    maybeRunMemoryDynamicsTick(store);
    const r2 = maybeRunMemoryDynamicsTick(store);
    expect(r2.ran).toBe(false);
    expect(r2.reason).toBe("rate_limited");
    expect(typeof r2.lastTickAt).toBe("string");
  });

  it("runs again after the interval elapses (simulated via a stale timestamp)", () => {
    const stale = new Date(Date.now() - DEFAULT_TICK_INTERVAL_MS - 1000).toISOString();
    store.setProjectSetting(MEMORY_DYNAMICS_TICK_KEY, stale);
    const r = maybeRunMemoryDynamicsTick(store);
    expect(r.ran).toBe(true);
    expect(r.reason).toBe("ran");
    // New timestamp is more recent than the stale one.
    expect(new Date(r.lastTickAt!).getTime()).toBeGreaterThan(new Date(stale).getTime());
  });

  it("force=true bypasses the rate limit", () => {
    maybeRunMemoryDynamicsTick(store);
    const r = maybeRunMemoryDynamicsTick(store, { force: true });
    expect(r.ran).toBe(true);
  });

  it("respects a per-project intervalMs override via project_settings — 0ms always runs", () => {
    // 0ms interval means: never rate-limit (any elapsed time satisfies).
    store.setProjectSetting("memory_dynamics_tick_interval_ms", "0");
    maybeRunMemoryDynamicsTick(store);
    const r = maybeRunMemoryDynamicsTick(store);
    expect(r.ran).toBe(true);
  });

  it("runs all three dynamics passes — consolidates near-duplicates", async () => {
    const ks = new KnowledgeStore(store.getDb());
    const older = ks.insert({ sourceType: "memory", sourceId: "older", title: "O", content: BASE });
    store.getDb().prepare("UPDATE knowledge_documents SET created_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").run(older.id);
    await new Promise((r) => setTimeout(r, 5));
    ks.insert({ sourceType: "memory", sourceId: "newer", title: "N", content: VARIANT });

    const r = maybeRunMemoryDynamicsTick(store);
    expect(r.ran).toBe(true);
    expect(r.consolidated).toBeGreaterThanOrEqual(1);
  });

  it("does not throw when there is no work to do", () => {
    const r = maybeRunMemoryDynamicsTick(store);
    expect(r.ran).toBe(true);
    expect(r.consolidated ?? 0).toBe(0);
    expect(r.forgotten ?? 0).toBe(0);
  });
});
