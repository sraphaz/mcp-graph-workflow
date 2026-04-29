/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T01 — Token Economy migration v82.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migration v82 — Token Economy (E6.T01)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("registers v82 in _migrations with E6 description", () => {
    const row = db
      .prepare("SELECT description FROM _migrations WHERE version = 82")
      .get() as { description: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.description.toLowerCase()).toMatch(/token|economy|cache/);
  });

  it("llm_response_cache has expected columns", () => {
    const cols = db
      .prepare("PRAGMA table_info(llm_response_cache)")
      .all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    for (const col of [
      "key",
      "value_json",
      "schema_version",
      "created_at_ms",
      "ttl_expires_at",
    ]) {
      expect(names.has(col), `missing llm_response_cache.${col}`).toBe(true);
    }
  });

  it("economy_metrics tracks tokens_saved + cost_saved + tier", () => {
    const cols = db
      .prepare("PRAGMA table_info(economy_metrics)")
      .all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    for (const col of [
      "id",
      "ts",
      "tier",
      "tokens_saved",
      "cost_saved",
      "cache_hit",
      "node_id",
    ]) {
      expect(names.has(col), `missing economy_metrics.${col}`).toBe(true);
    }
  });

  it("INSERT into llm_response_cache with full row succeeds", () => {
    expect(() => {
      db.prepare(
        `INSERT INTO llm_response_cache
           (key, value_json, schema_version, created_at_ms, ttl_expires_at)
         VALUES ('k1', '"v"', 1, 100, 200)`,
      ).run();
    }).not.toThrow();
  });

  it("TTL prune query removes only expired rows (covered by ttl index)", () => {
    db.prepare(
      `INSERT INTO llm_response_cache
         (key, value_json, schema_version, created_at_ms, ttl_expires_at)
       VALUES ('a', '"x"', 1, 100, 50),
              ('b', '"y"', 1, 100, 9999)`,
    ).run();
    const info = db
      .prepare(`DELETE FROM llm_response_cache WHERE ttl_expires_at <= ?`)
      .run(100);
    expect(info.changes).toBe(1);
    const remaining = db
      .prepare(`SELECT key FROM llm_response_cache`)
      .all() as Array<{ key: string }>;
    expect(remaining.map((r) => r.key)).toEqual(["b"]);
  });

  it("INSERT into economy_metrics with cache hit accounting works", () => {
    db.prepare(
      `INSERT INTO economy_metrics
         (id, ts, tier, tokens_saved, cost_saved, cache_hit, node_id)
       VALUES ('m1', 100, 'tier0', 1500, 0.045, 1, 'node-x')`,
    ).run();
    const row = db
      .prepare(
        `SELECT tokens_saved, cost_saved, cache_hit FROM economy_metrics WHERE id='m1'`,
      )
      .get() as { tokens_saved: number; cost_saved: number; cache_hit: number };
    expect(row.tokens_saved).toBe(1500);
    expect(row.cost_saved).toBeCloseTo(0.045);
    expect(row.cache_hit).toBe(1);
  });
});
