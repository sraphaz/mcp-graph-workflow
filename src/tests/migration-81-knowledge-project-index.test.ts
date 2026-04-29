/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-12.T07 — knowledge_documents project_id index.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migration v81 — knowledge_documents project_id index (E12.T07)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("registers v81 in _migrations", () => {
    const row = db
      .prepare("SELECT description FROM _migrations WHERE version = 81")
      .get() as { description: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.description.toLowerCase()).toMatch(/project|knowledge/);
  });

  it("creates idx_knowledge_documents_project_id", () => {
    const indexes = db
      .prepare("PRAGMA index_list(knowledge_documents)")
      .all() as Array<{ name: string }>;
    const found = indexes.some((i) => i.name === "idx_knowledge_documents_project_id");
    expect(found).toBe(true);
  });

  it("EXPLAIN QUERY PLAN uses the new index for WHERE project_id = ?", () => {
    db.prepare(`INSERT INTO projects (id, name, created_at, updated_at)
                VALUES ('p1','T','2026-01-01','2026-01-01')`).run();
    db.prepare(`INSERT INTO knowledge_documents
                (id, project_id, source_type, source_id, title, content, content_hash, created_at, updated_at)
                VALUES ('k1','p1','prd','s1','t','test','h','2026-01-01','2026-01-01')`).run();
    const plan = db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT id FROM knowledge_documents WHERE project_id = ?",
      )
      .all("p1") as Array<{ detail: string }>;
    const detail = plan.map((p) => p.detail).join(" | ").toLowerCase();
    expect(detail).toContain("idx_knowledge_documents_project_id");
  });

  it("INSERT into knowledge_documents still works after index add", () => {
    db.prepare(`INSERT INTO projects (id, name, created_at, updated_at)
                VALUES ('p2','T','2026-01-01','2026-01-01')`).run();
    expect(() =>
      db
        .prepare(
          `INSERT INTO knowledge_documents
           (id, project_id, source_type, source_id, title, content, content_hash, created_at, updated_at)
           VALUES ('k2','p2','prd','s2','t','x','h2','2026-01-01','2026-01-01')`,
        )
        .run(),
    ).not.toThrow();
  });
});
