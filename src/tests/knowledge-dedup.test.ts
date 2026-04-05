import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  findDuplicates,
  findContradictions,


} from "../core/rag/knowledge-dedup.js";

describe("Knowledge Dedup & Contradiction Detection", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  function insertDoc(id: string, title: string, content: string, sourceType = "docs"): void {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, quality_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(id, sourceType, "src1", title, content, `hash_${id}`, 0.7, now, now);
  }

  describe("findDuplicates", () => {
    it("should detect near-duplicate documents (Jaccard >0.7)", () => {
      insertDoc("d1", "TypeScript Setup Guide", "Install TypeScript globally using npm install typescript for your development environment setup");
      insertDoc("d2", "TypeScript Installation", "Install TypeScript globally using npm install typescript for your development setup environment");
      insertDoc("d3", "Docker Containers Guide", "Docker containers provide isolated environments for running applications consistently");

      const dupes = findDuplicates(db);

      expect(dupes.length).toBeGreaterThan(0);
      expect(dupes[0].docId1).toBeDefined();
      expect(dupes[0].docId2).toBeDefined();
      expect(dupes[0].similarity).toBeGreaterThan(0.7);
    });

    it("should NOT flag completely different documents as duplicates", () => {
      insertDoc("d1", "TypeScript Guide", "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript code");
      insertDoc("d2", "Docker Guide", "Docker provides containerization for applications making deployment consistent and repeatable");

      const dupes = findDuplicates(db);

      expect(dupes).toHaveLength(0);
    });

    it("should return empty for single document", () => {
      insertDoc("d1", "Only Doc", "This is the only document in the knowledge store");

      const dupes = findDuplicates(db);
      expect(dupes).toHaveLength(0);
    });
  });

  describe("findContradictions", () => {
    it("should detect contradicting statements via negation patterns", () => {
      insertDoc("d1", "Config A", "The system should always use strict mode for TypeScript compilation");
      insertDoc("d2", "Config B", "The system should never use strict mode for TypeScript compilation");

      const contradictions = findContradictions(db);

      expect(contradictions.length).toBeGreaterThan(0);
      expect(contradictions[0].docId1).toBeDefined();
      expect(contradictions[0].docId2).toBeDefined();
      expect(contradictions[0].reason).toBeDefined();
    });

    it("should NOT flag non-contradicting documents", () => {
      insertDoc("d1", "Feature A", "The system supports TypeScript strict mode compilation");
      insertDoc("d2", "Feature B", "The system also supports JavaScript module compilation");

      const contradictions = findContradictions(db);
      expect(contradictions).toHaveLength(0);
    });
  });
});
