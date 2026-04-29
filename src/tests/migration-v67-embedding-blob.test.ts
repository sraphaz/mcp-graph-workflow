/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

describe("migration v67 — embedding_blob + vector_dim columns", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb();
  });

  afterEach(() => {
    db.close();
  });

  it("embeddings table gains embedding_blob BLOB column", () => {
    const columns = db.prepare("PRAGMA table_info(embeddings)").all() as Array<{ name: string; type: string }>;
    const col = columns.find((c) => c.name === "embedding_blob");
    expect(col).toBeDefined();
    expect(col?.type.toUpperCase()).toBe("BLOB");
  });

  it("embeddings table gains vector_dim INT column", () => {
    const columns = db.prepare("PRAGMA table_info(embeddings)").all() as Array<{ name: string; type: string }>;
    const col = columns.find((c) => c.name === "vector_dim");
    expect(col).toBeDefined();
    expect(col?.type.toUpperCase()).toContain("INT");
  });

  it("new columns are nullable (no NOT NULL constraint)", () => {
    const columns = db.prepare("PRAGMA table_info(embeddings)").all() as Array<{ name: string; notnull: number }>;
    const blob = columns.find((c) => c.name === "embedding_blob");
    const dim = columns.find((c) => c.name === "vector_dim");
    expect(blob?.notnull).toBe(0);
    expect(dim?.notnull).toBe(0);
  });

  it("migration applies on populated DB — existing rows survive", () => {
    // Insert a row using only pre-v67 columns
    db.prepare(`
      INSERT INTO embeddings (id, source, source_id, text, embedding, embedding_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("e1", "knowledge", "doc-1", "hello world", Buffer.from([1, 2, 3, 4]), "tfidf", new Date().toISOString());

    const rows = db.prepare("SELECT * FROM embeddings").all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    // Old rows have NULL for new columns
    expect(rows[0].embedding_blob).toBeNull();
    expect(rows[0].vector_dim).toBeNull();
  });

  it("backfill noop when no rows — table remains empty", () => {
    const count = (db.prepare("SELECT COUNT(*) as cnt FROM embeddings").get() as { cnt: number }).cnt;
    expect(count).toBe(0);
  });

  it("can INSERT with embedding_blob and vector_dim values", () => {
    const blob = Buffer.from(new Float32Array([0.1, 0.2, 0.3]).buffer);
    db.prepare(`
      INSERT INTO embeddings (id, source, source_id, text, embedding, embedding_type, created_at, embedding_blob, vector_dim)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("e2", "knowledge", "doc-2", "semantic text", blob, "onnx", new Date().toISOString(), blob, 384);

    const row = db.prepare("SELECT * FROM embeddings WHERE id = ?").get("e2") as Record<string, unknown>;
    expect(row.vector_dim).toBe(384);
    expect(row.embedding_blob).toBeInstanceOf(Buffer);
  });

  it("migration is idempotent — running again does not throw", () => {
    expect(() => runMigrations(db)).not.toThrow();
  });
});
