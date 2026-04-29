/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { HookStatsStore } from "../core/hooks/hook-stats-store.js";
import { HookRegistry } from "../core/hooks/hook-registry.js";

describe("HookStatsStore — per-handler observability", () => {
  let db: Database.Database;
  let store: HookStatsStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new HookStatsStore(db);
  });

  afterEach(() => db.close());

  it("inserts a fresh row on first record", () => {
    store.record("h1", 12, null);
    const stats = store.get("h1");
    expect(stats?.callCount).toBe(1);
    expect(stats?.p50Duration).toBe(12);
    expect(stats?.p95Duration).toBe(12);
    expect(stats?.lastError).toBeNull();
  });

  it("increments callCount and updates EWMA on subsequent records", () => {
    store.record("h2", 10, null);
    store.record("h2", 20, null);
    store.record("h2", 30, null);
    const stats = store.get("h2");
    expect(stats?.callCount).toBe(3);
    expect(stats?.p50Duration).toBeGreaterThan(10);
    expect(stats?.p95Duration).toBeGreaterThanOrEqual(stats!.p50Duration!);
  });

  it("stores lastError when provided", () => {
    store.record("h3", 5, "boom");
    const stats = store.get("h3");
    expect(stats?.lastError).toBe("boom");
  });

  it("setCircuitState upserts and persists circuit transitions", () => {
    store.setCircuitState("h4", "open");
    expect(store.get("h4")?.circuitState).toBe("open");
    store.setCircuitState("h4", "half-open");
    expect(store.get("h4")?.circuitState).toBe("half-open");
  });

  it("list returns rows sorted by call_count DESC", () => {
    store.record("a", 1, null);
    store.record("b", 1, null);
    store.record("b", 1, null);
    store.record("c", 1, null);
    store.record("c", 1, null);
    store.record("c", 1, null);
    const ids = store.list().map((s) => s.handlerId);
    expect(ids).toEqual(["c", "b", "a"]);
  });
});

describe("HookRegistry — stats integration", () => {
  let db: Database.Database;
  let registry: HookRegistry;
  let stats: HookStatsStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    stats = new HookStatsStore(db);
    registry = new HookRegistry();
    registry.attachStatsStore(stats);
  });

  afterEach(() => db.close());

  it("records call_count for each successful dispatch", async () => {
    registry.register({
      id: "ok",
      channel: "task:pre-execute",
      handler: async () => { /* no-op */ },
      priority: 0,
    });
    await registry.dispatch({ channel: "task:pre-execute", timestamp: "t", payload: {} });
    await registry.dispatch({ channel: "task:pre-execute", timestamp: "t", payload: {} });
    expect(stats.get("ok")?.callCount).toBe(2);
    expect(stats.get("ok")?.lastError).toBeNull();
  });

  it("records lastError when a handler throws", async () => {
    registry.register({
      id: "err",
      channel: "task:pre-execute",
      handler: async () => { throw new Error("nope"); },
      priority: 0,
    });
    await expect(registry.dispatch({ channel: "task:pre-execute", timestamp: "t", payload: {} })).rejects.toThrow("nope");
    expect(stats.get("err")?.lastError).toBe("nope");
    expect(stats.get("err")?.callCount).toBe(1);
  });
});
