/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { applyRelevanceBoosts } from "../core/rag/relevance-boost.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p', 't', '2026-01-01', '2026-01-01')",
  ).run();
  return db;
}

describe("applyRelevanceBoosts", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("returns the same array reference on empty input", () => {
    const results: Array<{ id: string; score: number }> = [];
    expect(applyRelevanceBoosts(db, results)).toBe(results);
  });

  it("returns the same array on no-feedback DB", () => {
    const results = [
      { id: "doc1", score: 0.5 },
      { id: "doc2", score: 0.3 },
    ];
    const out = applyRelevanceBoosts(db, results);
    expect(out).toBe(results);
    expect(out[0].score).toBe(0.5);
    expect(out[1].score).toBe(0.3);
  });

  it("preserves extra fields on each result", () => {
    const results = [{ id: "doc1", score: 0.5, title: "hello", extra: 42 }];
    applyRelevanceBoosts(db, results);
    expect(results[0].title).toBe("hello");
    expect(results[0].extra).toBe(42);
  });

  it("clamps boosted scores to non-negative", () => {
    const results = [{ id: "doc1", score: 0 }];
    applyRelevanceBoosts(db, results);
    expect(results[0].score).toBeGreaterThanOrEqual(0);
  });

  it("returns the input array (mutation in place)", () => {
    const results = [{ id: "doc1", score: 0.5 }];
    const out = applyRelevanceBoosts(db, results);
    expect(out).toBe(results);
  });

  it("works with many results without throwing", () => {
    const results = Array.from({ length: 100 }, (_, i) => ({ id: `doc${i}`, score: 0.5 }));
    expect(() => applyRelevanceBoosts(db, results)).not.toThrow();
    expect(results).toHaveLength(100);
  });
});
