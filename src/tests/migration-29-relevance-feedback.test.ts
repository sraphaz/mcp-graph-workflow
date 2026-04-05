import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migration v29 — relevance_feedback table", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create relevance_feedback table with correct columns", () => {
    const cols = db
      .prepare("PRAGMA table_info(relevance_feedback)")
      .all() as Array<{ name: string; notnull: number }>;

    const colMap = new Map(cols.map((c) => [c.name, c]));

    expect(colMap.has("id")).toBe(true);
    expect(colMap.has("session_id")).toBe(true);
    expect(colMap.has("query")).toBe(true);
    expect(colMap.has("document_id")).toBe(true);
    expect(colMap.has("signal")).toBe(true);
    expect(colMap.has("created_at")).toBe(true);

    expect(colMap.get("session_id")!.notnull).toBe(1);
    expect(colMap.get("query")!.notnull).toBe(1);
    expect(colMap.get("document_id")!.notnull).toBe(1);
    expect(colMap.get("signal")!.notnull).toBe(1);
  });

  it("should have index on session_id", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='relevance_feedback'")
      .all() as Array<{ name: string }>;

    expect(indexes.some((i) => i.name.includes("session"))).toBe(true);
  });

  it("should have index on document_id", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='relevance_feedback'")
      .all() as Array<{ name: string }>;

    expect(indexes.some((i) => i.name.includes("doc"))).toBe(true);
  });

  it("should accept inserts with valid signal values", () => {
    const now = new Date().toISOString();

    expect(() => {
      db.prepare(
        "INSERT INTO relevance_feedback (id, session_id, query, document_id, signal, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("rf1", "sess1", "test query", "doc1", "positive", now);
    }).not.toThrow();

    expect(() => {
      db.prepare(
        "INSERT INTO relevance_feedback (id, session_id, query, document_id, signal, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("rf2", "sess1", "test query", "doc2", "negative", now);
    }).not.toThrow();

    const count = db.prepare("SELECT COUNT(*) as cnt FROM relevance_feedback").get() as { cnt: number };
    expect(count.cnt).toBe(2);
  });
});
