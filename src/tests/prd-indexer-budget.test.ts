/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * BUG-02 — indexPrdContent must enforce a knowledge-store budget so that
 * importing many PRDs does not balloon the store and break context(rag)/
 * context(compact) economics.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexPrdContent } from "../core/rag/prd-indexer.js";

function migratedDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
  ).run("p1", "p1");
  return db;
}

const LARGE_PRD = "## Section\n\n" + "x ".repeat(2000);

describe("indexPrdContent — budget enforcement (BUG-02)", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = migratedDb();
    store = new KnowledgeStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("default behavior (no budget option): inserts chunks unconditionally", () => {
    const r = indexPrdContent(store, LARGE_PRD, "prd-1.md");
    expect(r.documentsIndexed).toBeGreaterThanOrEqual(1);
    expect(r.pruned).toBe(0);
  });

  it("with budget option, auto-prunes when count exceeds budget", () => {
    indexPrdContent(store, LARGE_PRD, "prd-A.md");
    indexPrdContent(store, LARGE_PRD, "prd-B.md");
    indexPrdContent(store, LARGE_PRD, "prd-C.md");
    const before = store.count();
    expect(before).toBeGreaterThan(2);

    const r = indexPrdContent(store, LARGE_PRD, "prd-D.md", undefined, { budget: 2 });
    expect(r.pruned).toBeGreaterThan(0);
    expect(store.count()).toBeLessThanOrEqual(2);
  });

  it("budget=0 is treated as no-op (legacy behavior)", () => {
    const r = indexPrdContent(store, LARGE_PRD, "prd-x.md", undefined, { budget: 0 });
    expect(r.pruned).toBe(0);
    expect(store.count()).toBeGreaterThan(0);
  });

  it("returns the same documentsIndexed shape with budget option", () => {
    const r = indexPrdContent(store, LARGE_PRD, "prd-y.md", undefined, { budget: 100 });
    expect(typeof r.documentsIndexed).toBe("number");
    expect(typeof r.pruned).toBe("number");
    expect(r.sourceFile).toBe("prd-y.md");
  });
});
