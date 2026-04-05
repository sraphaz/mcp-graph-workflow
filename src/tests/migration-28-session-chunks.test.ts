import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migration 28 — session_chunks table", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create session_chunks table with correct columns", () => {
    const columns = db
      .prepare("PRAGMA table_info(session_chunks)")
      .all() as Array<{ name: string; type: string }>;

    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("session_id");
    expect(columnNames).toContain("content_hash");
    expect(columnNames).toContain("tokens");
    expect(columnNames).toContain("tracked_at");
  });

  it("should have correct column types", () => {
    const columns = db
      .prepare("PRAGMA table_info(session_chunks)")
      .all() as Array<{ name: string; type: string }>;

    const colMap = new Map(columns.map((c) => [c.name, c.type]));

    expect(colMap.get("session_id")).toBe("TEXT");
    expect(colMap.get("content_hash")).toBe("TEXT");
    expect(colMap.get("tokens")).toBe("INTEGER");
    expect(colMap.get("tracked_at")).toBe("TEXT");
  });

  it("should enforce UNIQUE constraint on (session_id, content_hash)", () => {
    const now = new Date().toISOString();

    db.prepare(
      "INSERT INTO session_chunks (session_id, content_hash, tokens, tracked_at) VALUES (?, ?, ?, ?)",
    ).run("sess1", "hash_abc", 150, now);

    expect(() => {
      db.prepare(
        "INSERT INTO session_chunks (session_id, content_hash, tokens, tracked_at) VALUES (?, ?, ?, ?)",
      ).run("sess1", "hash_abc", 200, now);
    }).toThrow(/UNIQUE constraint/);
  });

  it("should allow same content_hash in different sessions", () => {
    const now = new Date().toISOString();

    db.prepare(
      "INSERT INTO session_chunks (session_id, content_hash, tokens, tracked_at) VALUES (?, ?, ?, ?)",
    ).run("sess1", "hash_abc", 150, now);

    db.prepare(
      "INSERT INTO session_chunks (session_id, content_hash, tokens, tracked_at) VALUES (?, ?, ?, ?)",
    ).run("sess2", "hash_abc", 150, now);

    const count = db.prepare("SELECT COUNT(*) as cnt FROM session_chunks").get() as { cnt: number };
    expect(count.cnt).toBe(2);
  });

  it("should have index on session_id", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='session_chunks'")
      .all() as Array<{ name: string }>;

    expect(indexes.some((i) => i.name === "idx_session_chunks_session_id")).toBe(true);
  });
});
