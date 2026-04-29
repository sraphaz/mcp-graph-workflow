/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-9.T01 — Verify decision_log + decisions tables exist with the
 * fields the spec requires. The original AC asked for migration v74 with a
 * single `decision_log` table; the actual implementation split into two
 * complementary tables:
 *   - decision_log (v52): confidence-scorer replay log
 *   - decisions    (v80): the `decide` MCP tool action store
 * This test asserts both surfaces satisfy the AC fields.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("decision tables (E9.T01)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("decision_log (v52) exists with confidence scorer fields", () => {
    const cols = db
      .prepare("PRAGMA table_info(decision_log)")
      .all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    for (const c of ["id", "node_id", "decision", "outcome", "created_at"]) {
      expect(names.has(c), `decision_log.${c}`).toBe(true);
    }
  });

  it("decisions (v80) exists with decide-tool fields (intent/options/chosen/reasoning)", () => {
    const cols = db
      .prepare("PRAGMA table_info(decisions)")
      .all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    for (const c of [
      "id", "intent", "options_json", "chosen", "reasoning",
      "node_id", "success", "result_summary", "outcome_at", "created_at",
    ]) {
      expect(names.has(c), `decisions.${c}`).toBe(true);
    }
  });

  it("decisions has node_id and created_at indexes", () => {
    const ix = db
      .prepare("PRAGMA index_list(decisions)")
      .all() as Array<{ name: string }>;
    const names = ix.map((i) => i.name);
    expect(names.some((n) => n.includes("node"))).toBe(true);
    expect(names.some((n) => n.includes("created"))).toBe(true);
  });

  it("INSERT into decisions backward-compatible (only required fields)", () => {
    const now = "2026-04-29T00:00:00Z";
    expect(() =>
      db
        .prepare(
          `INSERT INTO decisions
             (id, intent, options_json, chosen, reasoning, created_at)
           VALUES ('d1', 'i', '[]', 'c', 'r', ?)`,
        )
        .run(now),
    ).not.toThrow();
  });

  it("both v52 and v80 registered in _migrations", () => {
    const versions = db
      .prepare(
        "SELECT version FROM _migrations WHERE version IN (52, 80) ORDER BY version",
      )
      .all() as Array<{ version: number }>;
    expect(versions.map((v) => v.version)).toEqual([52, 80]);
  });
});
