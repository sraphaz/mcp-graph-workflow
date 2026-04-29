/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.D3 — lessons_learned table (v78) + source column (v79).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migrations v78 + v79 — lessons_learned (E22.D3)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("lessons_learned table created with full required schema", () => {
    const cols = db
      .prepare("PRAGMA table_info(lessons_learned)")
      .all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    for (const col of [
      "id",
      "pattern_hash",
      "description",
      "recommended_action",
      "confidence",
      "applied_count",
      "source",
      "created_at",
      "updated_at",
    ]) {
      expect(names.has(col), `missing lessons_learned.${col}`).toBe(true);
    }
  });

  it("v78 and v79 both registered in _migrations", () => {
    const versions = db
      .prepare("SELECT version FROM _migrations WHERE version IN (78, 79) ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(versions.map((v) => v.version)).toEqual([78, 79]);
  });

  it("indexes present: pattern, action, confidence DESC, source", () => {
    const indexes = db
      .prepare("PRAGMA index_list(lessons_learned)")
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);
    expect(names.some((n) => n.includes("pattern"))).toBe(true);
    expect(names.some((n) => n.includes("action"))).toBe(true);
    expect(names.some((n) => n.includes("confidence"))).toBe(true);
    expect(names.some((n) => n.includes("source"))).toBe(true);
  });

  it("INSERT with source defaults to 'unknown' when omitted (post v79)", () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO lessons_learned
         (id, pattern_hash, description, recommended_action, applied_count, confidence, created_at, updated_at)
       VALUES ('l1', 'h1', 'desc', 'skip-similar', 1, 0.8, ?, ?)`,
    ).run(now, now);
    const row = db
      .prepare(`SELECT source FROM lessons_learned WHERE id = 'l1'`)
      .get() as { source: string };
    expect(row.source).toBe("unknown");
  });

  it("INSERT with explicit source persists the source", () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO lessons_learned
         (id, pattern_hash, description, recommended_action, applied_count, confidence, source, created_at, updated_at)
       VALUES ('l2', 'h2', 'desc', 'retry', 2, 0.9, 'dream-engine', ?, ?)`,
    ).run(now, now);
    const row = db
      .prepare(`SELECT source FROM lessons_learned WHERE id = 'l2'`)
      .get() as { source: string };
    expect(row.source).toBe("dream-engine");
  });
});
