import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { pruneKnowledge } from "../core/rag/knowledge-pruner.js";

describe("Knowledge Pruner", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  function insertDoc(id: string, sourceType: string, content: string, daysOld = 0, qualityScore = 0.7): void {
    const created = new Date(Date.now() - daysOld * 86400000).toISOString();
    db.prepare(
      "INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, quality_score, staleness_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(id, sourceType, "src1", `Doc ${id}`, content, `hash_${id}`, qualityScore, daysOld, created, created);
  }

  describe("age strategy", () => {
    it("should prune documents older than maxAgeDays", () => {
      insertDoc("old1", "docs", "old content", 100);
      insertDoc("old2", "docs", "old content 2", 200);
      insertDoc("fresh1", "docs", "fresh content", 5);

      const result = pruneKnowledge(db, { strategy: "age", maxAgeDays: 90, dryRun: false });

      expect(result.pruned).toBe(2);
      expect(result.prunedIds).toContain("old1");
      expect(result.prunedIds).toContain("old2");
    });

    it("should not prune fresh documents", () => {
      insertDoc("fresh1", "docs", "fresh content", 5);

      const result = pruneKnowledge(db, { strategy: "age", maxAgeDays: 90, dryRun: false });

      expect(result.pruned).toBe(0);
    });
  });

  describe("quality strategy", () => {
    it("should prune low-quality documents", () => {
      insertDoc("low1", "docs", "low quality", 10, 0.1);
      insertDoc("low2", "docs", "low quality 2", 10, 0.15);
      insertDoc("good1", "docs", "good quality", 10, 0.8);

      const result = pruneKnowledge(db, { strategy: "quality", minQuality: 0.3, dryRun: false });

      expect(result.pruned).toBe(2);
    });
  });

  describe("dryRun", () => {
    it("should report but not delete in dryRun mode", () => {
      insertDoc("old1", "docs", "old content", 200);

      const result = pruneKnowledge(db, { strategy: "age", maxAgeDays: 90, dryRun: true });

      expect(result.pruned).toBe(1);
      expect(result.dryRun).toBe(true);

      // Verify not actually deleted
      const count = db.prepare("SELECT COUNT(*) as cnt FROM knowledge_documents").get() as { cnt: number };
      expect(count.cnt).toBe(1);
    });
  });

  describe("empty store", () => {
    it("should return zero pruned", () => {
      const result = pruneKnowledge(db, { strategy: "age", maxAgeDays: 90, dryRun: false });
      expect(result.pruned).toBe(0);
    });
  });
});
