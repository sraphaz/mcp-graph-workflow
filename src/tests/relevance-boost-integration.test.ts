import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { RelevanceTracker } from "../core/rag/relevance-tracker.js";
import { applyRelevanceBoosts } from "../core/rag/relevance-boost.js";

interface ScoredResult {
  id: string;
  score: number;
}

describe("applyRelevanceBoosts", () => {
  let db: Database.Database;
  let tracker: RelevanceTracker;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    tracker = new RelevanceTracker(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should boost score for docs with positive feedback", () => {
    tracker.trackQuery("sess1", "TypeScript features", ["doc1"]);
    tracker.trackQuery("sess2", "TypeScript types", ["doc1"]);

    const results: ScoredResult[] = [
      { id: "doc1", score: 0.5 },
      { id: "doc2", score: 0.5 },
    ];

    const boosted = applyRelevanceBoosts(db, results);

    // doc1 should have higher score than doc2 (doc2 has no feedback)
    const doc1 = boosted.find((r) => r.id === "doc1")!;
    const doc2 = boosted.find((r) => r.id === "doc2")!;

    expect(doc1.score).toBeGreaterThan(doc2.score);
  });

  it("should reduce score for docs with negative feedback", () => {
    // Positive first, then requery makes it negative
    tracker.trackQuery("sess1", "TypeScript compiler optimization", ["doc1"]);
    tracker.detectRequery("sess1", "TypeScript compiler performance");

    // Add extra negative to ensure doc1 has net negative
    db.prepare(
      "INSERT INTO relevance_feedback (id, session_id, query, document_id, signal, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("extra", "sess2", "q", "doc1", "negative", new Date().toISOString());

    const results: ScoredResult[] = [
      { id: "doc1", score: 0.5 },
      { id: "doc2", score: 0.5 },
    ];

    const boosted = applyRelevanceBoosts(db, results);

    const doc1 = boosted.find((r) => r.id === "doc1")!;
    const doc2 = boosted.find((r) => r.id === "doc2")!;

    expect(doc1.score).toBeLessThan(doc2.score);
  });

  it("should not change scores when no feedback exists", () => {
    const results: ScoredResult[] = [
      { id: "doc1", score: 0.7 },
      { id: "doc2", score: 0.3 },
    ];

    const boosted = applyRelevanceBoosts(db, results);

    expect(boosted[0].score).toBe(0.7);
    expect(boosted[1].score).toBe(0.3);
  });

  it("should handle empty results", () => {
    const boosted = applyRelevanceBoosts(db, []);
    expect(boosted).toEqual([]);
  });
});
