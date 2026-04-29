/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-11.T01 — verify llm_call_ledger has cache columns wired through migrations.
 *
 * Note: the columns ship with their canonical Anthropic names
 * (`cached_input_tokens`, `cache_creation_tokens`) introduced in migration
 * v70, which subsumes the original intent of v75 (the version was bumped
 * during EPIC 16 implementation; v75 was reused for an unrelated change).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("llm_call_ledger cache columns (E11.T01)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("has cached_input_tokens INTEGER nullable column", () => {
    const cols = db
      .prepare("PRAGMA table_info(llm_call_ledger)")
      .all() as Array<{ name: string; type: string; notnull: number }>;
    const col = cols.find((c) => c.name === "cached_input_tokens");
    expect(col).toBeDefined();
    expect(col?.type.toUpperCase()).toBe("INTEGER");
    expect(col?.notnull).toBe(0);
  });

  it("has cache_creation_tokens INTEGER nullable column", () => {
    const cols = db
      .prepare("PRAGMA table_info(llm_call_ledger)")
      .all() as Array<{ name: string; type: string; notnull: number }>;
    const col = cols.find((c) => c.name === "cache_creation_tokens");
    expect(col).toBeDefined();
    expect(col?.type.toUpperCase()).toBe("INTEGER");
    expect(col?.notnull).toBe(0);
  });

  it("INSERT without cache columns succeeds (backward compat)", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO llm_call_ledger
             (id, ts, provider, model, input_tokens, output_tokens, cost_usd, status)
           VALUES ('l1', ?, 'a', 'm', 100, 50, 0.01, 'ok')`,
        )
        .run(Date.now()),
    ).not.toThrow();
    const row = db
      .prepare(
        `SELECT cached_input_tokens, cache_creation_tokens FROM llm_call_ledger WHERE id = 'l1'`,
      )
      .get() as { cached_input_tokens: number | null; cache_creation_tokens: number | null };
    expect(row.cached_input_tokens).toBeNull();
    expect(row.cache_creation_tokens).toBeNull();
  });

  it("INSERT with cache columns persists values", () => {
    db.prepare(
      `INSERT INTO llm_call_ledger
         (id, ts, provider, model, input_tokens, output_tokens, cost_usd, status,
          cached_input_tokens, cache_creation_tokens)
       VALUES ('l2', ?, 'a', 'm', 100, 50, 0.01, 'ok', 80, 20)`,
    ).run(Date.now());
    const row = db
      .prepare(
        `SELECT cached_input_tokens, cache_creation_tokens FROM llm_call_ledger WHERE id = 'l2'`,
      )
      .get() as { cached_input_tokens: number; cache_creation_tokens: number };
    expect(row.cached_input_tokens).toBe(80);
    expect(row.cache_creation_tokens).toBe(20);
  });

  it("ledger creation migration is registered in _migrations", () => {
    const m = db
      .prepare("SELECT description FROM _migrations WHERE description LIKE '%ledger%'")
      .all() as Array<{ description: string }>;
    expect(m.length).toBeGreaterThanOrEqual(1);
  });
});
