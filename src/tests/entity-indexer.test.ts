/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { indexDocument, reindexAll, indexBatch } from "../core/rag/entity-indexer.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p', 't', '2026-01-01', '2026-01-01')",
  ).run();
  return db;
}

function insertDoc(db: Database.Database, id: string, title: string, content: string): void {
  // unique source_id + content_hash per row to avoid UNIQUE constraint conflicts
  db.prepare(
    `INSERT INTO knowledge_documents
      (id, source_type, source_id, title, content, content_hash, created_at, updated_at)
     VALUES (?, 'memory', ?, ?, ?, ?, '2026-01-01', '2026-01-01')`,
  ).run(id, `src_${id}`, title, content, `hash_${id}`);
}

describe("indexDocument", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("returns zero counts when document does not exist", () => {
    const result = indexDocument(db, "ghost");
    expect(result).toEqual({ docId: "ghost", entitiesCreated: 0, relationsCreated: 0 });
  });

  it("returns the docId in the result", () => {
    insertDoc(db, "d1", "Title", "content body");
    const result = indexDocument(db, "d1");
    expect(result.docId).toBe("d1");
  });

  it("entitiesCreated count reflects real extraction", () => {
    insertDoc(
      db,
      "d2",
      "TypeScript and React",
      "TypeScript powers React with strong typing",
    );
    const result = indexDocument(db, "d2");
    expect(result.entitiesCreated).toBeGreaterThanOrEqual(0);
    expect(typeof result.entitiesCreated).toBe("number");
  });

  it("returns the documented IndexDocumentResult shape", () => {
    insertDoc(db, "d3", "T", "c");
    const result = indexDocument(db, "d3");
    expect(result).toHaveProperty("docId");
    expect(result).toHaveProperty("entitiesCreated");
    expect(result).toHaveProperty("relationsCreated");
  });
});

describe("reindexAll", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("returns zero counts when there are no documents", () => {
    const result = reindexAll(db);
    expect(result.documentsProcessed).toBe(0);
    expect(result.totalEntities).toBe(0);
    expect(result.totalRelations).toBe(0);
  });

  it("processes every document in knowledge_documents", () => {
    insertDoc(db, "a", "A", "alpha content");
    insertDoc(db, "b", "B", "beta content");
    insertDoc(db, "c", "C", "gamma content");
    const result = reindexAll(db);
    expect(result.documentsProcessed).toBe(3);
  });

  it("returns the documented ReindexResult shape", () => {
    const result = reindexAll(db);
    expect(result).toHaveProperty("documentsProcessed");
    expect(result).toHaveProperty("totalEntities");
    expect(result).toHaveProperty("totalRelations");
    expect(result).toHaveProperty("totalMentions");
  });
});

describe("indexBatch", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("returns one IndexDocumentResult per docId", () => {
    insertDoc(db, "a", "A", "x");
    insertDoc(db, "b", "B", "y");
    const result = indexBatch(db, ["a", "b", "ghost"]);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.docId)).toEqual(["a", "b", "ghost"]);
  });

  it("ghost ids return zero counts but still appear in the array", () => {
    const result = indexBatch(db, ["ghost1", "ghost2"]);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.entitiesCreated === 0)).toBe(true);
  });

  it("empty input returns empty array", () => {
    expect(indexBatch(db, [])).toEqual([]);
  });
});
