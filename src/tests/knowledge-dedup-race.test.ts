import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

describe("Knowledge store dedup race condition (E1-T05)", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  afterEach(() => {
    db.close();
  });

  const makeDoc = (content = "test content", sourceId = "src1") => ({
    sourceType: "docs" as const,
    sourceId,
    title: "Test Doc",
    content,
  });

  // ── AC1: concurrent inserts with same content_hash+source_id produce exactly 1 row ──

  describe("dedup on same content_hash + source_id", () => {
    it("should produce exactly 1 row when inserting same content twice", () => {
      const doc = makeDoc("identical content", "src1");

      const first = store.insert(doc);
      const second = store.insert(doc);

      // Both should return the same document
      expect(first.id).toBe(second.id);

      // Only 1 row in the database
      const count = db
        .prepare("SELECT COUNT(*) as cnt FROM knowledge_documents WHERE content_hash = ? AND source_id = ?")
        .get(first.contentHash, "src1") as { cnt: number };
      expect(count.cnt).toBe(1);
    });

    it("should produce exactly 1 row via INSERT OR IGNORE at DB level", () => {
      // Directly test the UNIQUE constraint exists
      const doc = makeDoc("unique constraint test", "src1");
      const first = store.insert(doc);

      // Try raw INSERT with same content_hash + source_id — should be rejected by UNIQUE
      const hash = first.contentHash;
      const timestamp = new Date().toISOString();

      // This should NOT throw (INSERT OR IGNORE), and should not create a duplicate
      const result = db.prepare(
        `INSERT OR IGNORE INTO knowledge_documents
          (id, source_type, source_id, title, content, content_hash, chunk_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("kdoc_duplicate", "docs", "src1", "Dupe", "unique constraint test", hash, 0, timestamp, timestamp);

      expect(result.changes).toBe(0); // No row inserted due to UNIQUE constraint
    });
  });

  // ── AC2: no duplicate documents in knowledge store ──

  describe("no duplicates in store", () => {
    it("should not create duplicates when inserting same content via insertChunks", () => {
      const doc1 = makeDoc("chunk content A", "src1");
      const doc2 = makeDoc("chunk content A", "src1"); // same content

      const results = store.insertChunks([doc1, doc2]);

      // Both calls should return a doc, but only 1 row in DB
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(results[1].id);

      const count = db
        .prepare("SELECT COUNT(*) as cnt FROM knowledge_documents")
        .get() as { cnt: number };
      expect(count.cnt).toBe(1);
    });

    it("should allow same content with different chunk_index", () => {
      const doc1 = makeDoc("shared chunk content", "src1");
      const doc2 = { ...makeDoc("shared chunk content", "src1"), chunkIndex: 1 };

      store.insert(doc1);
      store.insert(doc2);

      // Same content_hash + source_id → deduped to 1 row
      const count = db
        .prepare("SELECT COUNT(*) as cnt FROM knowledge_documents WHERE source_id = ?")
        .get("src1") as { cnt: number };
      expect(count.cnt).toBe(1);
    });
  });

  // ── AC3: existing dedup logic preserved for different source_ids ──

  describe("different source_ids produce separate rows", () => {
    it("should allow same content from different sources", () => {
      const doc1 = makeDoc("same content here", "source-alpha");
      const doc2 = makeDoc("same content here", "source-beta");

      const first = store.insert(doc1);
      const second = store.insert(doc2);

      // Different source_ids → different rows
      expect(first.id).not.toBe(second.id);

      const count = db
        .prepare("SELECT COUNT(*) as cnt FROM knowledge_documents WHERE content_hash = ?")
        .get(first.contentHash) as { cnt: number };
      expect(count.cnt).toBe(2);
    });

    it("should dedup within same source but not across sources", () => {
      store.insert(makeDoc("content X", "src1"));
      store.insert(makeDoc("content X", "src1")); // dedup
      store.insert(makeDoc("content X", "src2")); // different source → new row

      const count = db
        .prepare("SELECT COUNT(*) as cnt FROM knowledge_documents")
        .get() as { cnt: number };
      expect(count.cnt).toBe(2); // 1 for src1 + 1 for src2
    });
  });

  // ── UNIQUE constraint migration check ──

  describe("UNIQUE constraint exists", () => {
    it("should have a UNIQUE index on (content_hash, source_id)", () => {
      const indexes = db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'knowledge_documents'")
        .all() as { sql: string | null }[];

      const hasUniqueIndex = indexes.some(
        (idx) => idx.sql && /UNIQUE/i.test(idx.sql) && /content_hash/i.test(idx.sql) && /source_id/i.test(idx.sql),
      );

      expect(hasUniqueIndex).toBe(true);
    });
  });
});
