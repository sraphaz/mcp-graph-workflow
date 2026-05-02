/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { HookStatsStore } from "../core/hooks/hook-stats-store.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

describe("HookStatsStore", () => {
  let db: Database.Database;
  let store: HookStatsStore;

  beforeEach(() => {
    db = makeDb();
    store = new HookStatsStore(db);
  });

  it("first record creates row with circuit closed + count=1", () => {
    store.record("hook-a", 100);
    const row = store.get("hook-a");
    expect(row).not.toBeNull();
    expect(row!.callCount).toBe(1);
    expect(row!.p50Duration).toBe(100);
    expect(row!.p95Duration).toBe(100);
    expect(row!.circuitState).toBe("closed");
    expect(row!.lastError).toBeNull();
  });

  it("subsequent records increment callCount", () => {
    store.record("h", 50);
    store.record("h", 60);
    store.record("h", 70);
    expect(store.get("h")!.callCount).toBe(3);
  });

  it("p50 evolves via EWMA (0.7 prev + 0.3 new)", () => {
    store.record("h", 100);
    store.record("h", 200);
    const row = store.get("h")!;
    expect(row.p50Duration).toBeCloseTo(0.7 * 100 + 0.3 * 200, 5);
  });

  it("p95 takes the running max-with-decay (max(new, 0.95×prev))", () => {
    store.record("h", 100);
    store.record("h", 50);
    const row = store.get("h")!;
    expect(row.p95Duration).toBeCloseTo(Math.max(50, 0.95 * 100), 5);
  });

  it("p95 reflects new high when current value exceeds decayed prev", () => {
    store.record("h", 100);
    store.record("h", 500);
    const row = store.get("h")!;
    expect(row.p95Duration).toBe(500);
  });

  it("error string overrides previous lastError", () => {
    store.record("h", 100, "first error");
    store.record("h", 100, "second error");
    expect(store.get("h")!.lastError).toBe("second error");
  });

  it("error=null call preserves prior lastError (does not clear)", () => {
    store.record("h", 100, "boom");
    store.record("h", 100);
    expect(store.get("h")!.lastError).toBe("boom");
  });

  it("get returns null for unknown handlerId", () => {
    expect(store.get("missing")).toBeNull();
  });

  it("setCircuitState upserts (creates new row if needed)", () => {
    store.setCircuitState("brand-new", "open");
    const row = store.get("brand-new")!;
    expect(row.circuitState).toBe("open");
    expect(row.callCount).toBe(0);
  });

  it("setCircuitState preserves existing data when updating", () => {
    store.record("h", 100);
    store.setCircuitState("h", "half-open");
    const row = store.get("h")!;
    expect(row.callCount).toBe(1);
    expect(row.circuitState).toBe("half-open");
  });

  it("list returns rows sorted by call_count desc", () => {
    store.record("a", 10);
    store.record("b", 20);
    store.record("b", 30);
    store.record("c", 40);
    store.record("c", 50);
    store.record("c", 60);
    const list = store.list();
    expect(list.map((r) => r.handlerId)).toEqual(["c", "b", "a"]);
  });
});
