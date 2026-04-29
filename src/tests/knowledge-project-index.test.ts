/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db);
  return db;
}

function insertDoc(
  db: Database.Database,
  id: string,
  projectId: string,
  title: string,
  content: string,
): void {
  const now = new Date().toISOString();
  const hash = `hash-${id}`;
  db.prepare(`
    INSERT INTO knowledge_documents
      (id, source_type, source_id, title, content, content_hash, chunk_index, project_id, created_at, updated_at)
    VALUES (?, 'upload', ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(id, id, title, content, hash, projectId, now, now);
  db.prepare(`INSERT INTO knowledge_fts(rowid, title, content) VALUES (last_insert_rowid(), ?, ?)`).run(title, content);
}

describe("Migration v66 — knowledge_docs_project index", () => {
  it("knowledge_docs_project index exists after migrations", () => {
    const db = makeDb();
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='knowledge_docs_project'")
      .get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.name).toBe("knowledge_docs_project");
  });

  it("is idempotent — applying migrations twice does not throw", () => {
    const db = makeDb();
    expect(() => runMigrations(db)).not.toThrow();
  });
});

describe("KnowledgeStore — projectId filter isolation", () => {
  it("search() with projectId only returns docs from that project", () => {
    const db = makeDb();
    insertDoc(db, "doc-a1", "project-A", "typescript patterns", "advanced typescript generics");
    insertDoc(db, "doc-b1", "project-B", "typescript patterns", "advanced typescript generics");

    const store = new KnowledgeStore(db);
    const results = store.search("typescript", 10, "project-A");

    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.id).toBe("doc-a1");
    });
  });

  it("search() without projectId returns docs from all projects", () => {
    const db = makeDb();
    insertDoc(db, "doc-a2", "project-A", "typescript generic utility", "mapped types conditional");
    insertDoc(db, "doc-b2", "project-B", "typescript generic utility", "mapped types conditional");

    const store = new KnowledgeStore(db);
    const results = store.search("typescript generic", 10);

    const ids = results.map((r) => r.id);
    expect(ids).toContain("doc-a2");
    expect(ids).toContain("doc-b2");
  });

  it("searchWithQuality() with projectId only returns docs from that project", () => {
    const db = makeDb();
    insertDoc(db, "doc-c1", "project-C", "react hooks guide", "useState useEffect custom hooks");
    insertDoc(db, "doc-d1", "project-D", "react hooks guide", "useState useEffect custom hooks");

    const store = new KnowledgeStore(db);
    const results = store.searchWithQuality("react hooks", 10, { projectId: "project-C" });

    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.id).toBe("doc-c1");
    });
  });
});
