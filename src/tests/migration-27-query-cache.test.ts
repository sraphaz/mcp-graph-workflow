import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migration 27 — query_cache table", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create query_cache table with correct columns", () => {
    const columns = db
      .prepare("PRAGMA table_info(query_cache)")
      .all() as Array<{ name: string; type: string }>;

    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("query_hash");
    expect(columnNames).toContain("query_text");
    expect(columnNames).toContain("embedding");
    expect(columnNames).toContain("result_json");
    expect(columnNames).toContain("tokens_saved");
    expect(columnNames).toContain("hit_count");
    expect(columnNames).toContain("created_at");
    expect(columnNames).toContain("expires_at");
  });

  it("should have correct column types", () => {
    const columns = db
      .prepare("PRAGMA table_info(query_cache)")
      .all() as Array<{ name: string; type: string }>;

    const colMap = new Map(columns.map((c) => [c.name, c.type]));

    expect(colMap.get("query_hash")).toBe("TEXT");
    expect(colMap.get("query_text")).toBe("TEXT");
    expect(colMap.get("embedding")).toBe("BLOB");
    expect(colMap.get("result_json")).toBe("TEXT");
    expect(colMap.get("tokens_saved")).toBe("INTEGER");
    expect(colMap.get("hit_count")).toBe("INTEGER");
    expect(colMap.get("created_at")).toBe("TEXT");
    expect(colMap.get("expires_at")).toBe("TEXT");
  });

  it("should enforce UNIQUE constraint on query_hash", () => {
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO query_cache (query_hash, query_text, result_json, tokens_saved, hit_count, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("hash1", "test query", '{"result":"a"}', 100, 1, now, now);

    expect(() => {
      db.prepare(
        `INSERT INTO query_cache (query_hash, query_text, result_json, tokens_saved, hit_count, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run("hash1", "duplicate query", '{"result":"b"}', 50, 1, now, now);
    }).toThrow(/UNIQUE constraint/);
  });

  it("should allow different query_hash values", () => {
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO query_cache (query_hash, query_text, result_json, tokens_saved, hit_count, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("hash1", "query 1", '{"r":"1"}', 100, 1, now, now);

    db.prepare(
      `INSERT INTO query_cache (query_hash, query_text, result_json, tokens_saved, hit_count, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("hash2", "query 2", '{"r":"2"}', 200, 1, now, now);

    const count = db.prepare("SELECT COUNT(*) as cnt FROM query_cache").get() as { cnt: number };
    expect(count.cnt).toBe(2);
  });

  it("should allow NULL embedding column", () => {
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO query_cache (query_hash, query_text, result_json, tokens_saved, hit_count, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("hash_no_embed", "query", '{"r":"1"}', 50, 0, now, now);

    const row = db.prepare("SELECT embedding FROM query_cache WHERE query_hash = ?").get("hash_no_embed") as { embedding: Buffer | null };
    expect(row.embedding).toBeNull();
  });
});
