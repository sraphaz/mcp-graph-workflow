/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * BUG-02-B: prd-indexer quality scoring
 * Each PRD chunk gets qualityScore = min(1.0, chunkLength/500) + 0.2 bonus for GIVEN/WHEN/THEN/must/shall keywords.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexPrdContent } from "../core/rag/prd-indexer.js";

function makeProse(length: number): string {
  return "lorem ipsum ".repeat(Math.ceil(length / 12)).slice(0, length);
}

describe("indexPrdContent — quality scoring per chunk", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Indexer Quality Test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("assigns higher quality score to chunks with GIVEN/WHEN/THEN keywords", () => {
    const acContent = [
      "## Acceptance Criteria",
      "GIVEN a user with a valid session WHEN they call the API THEN the response is 200",
      "GIVEN an empty store WHEN queried THEN returns empty array",
    ].join("\n");

    indexPrdContent(ks, acContent, "test.md");

    const docs = ks.getBySourceId("prd:test.md");
    const acChunks = docs.filter((d) => d.content.includes("GIVEN") || d.content.includes("WHEN") || d.content.includes("THEN"));

    expect(acChunks.length).toBeGreaterThan(0);

    // Verify from DB that quality_score > 0.5 for AC chunks
    const db = store.getDb();
    for (const doc of acChunks) {
      const row = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?").get(doc.id) as { quality_score: number };
      expect(row.quality_score).toBeGreaterThan(0.5);
    }
  });

  it("assigns qualityScore = min(1.0, length/500) for prose chunks without keywords", () => {
    // A 250-char prose chunk should score ~0.5 (250/500)
    const shortProse = makeProse(250);
    indexPrdContent(ks, shortProse, "short.md");

    const docs = ks.getBySourceId("prd:short.md");
    expect(docs.length).toBeGreaterThan(0);

    const db = store.getDb();
    const row = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?").get(docs[0].id) as { quality_score: number };
    // score = min(1.0, 250/500) = 0.5 — no keyword bonus
    expect(row.quality_score).toBeCloseTo(0.5, 1);
  });

  it("caps quality score at 1.0 for long prose chunks", () => {
    // A 1000-char prose chunk without keywords: min(1.0, 1000/500) = 1.0
    const longProse = makeProse(1000);
    indexPrdContent(ks, longProse, "long.md");

    const docs = ks.getBySourceId("prd:long.md");
    expect(docs.length).toBeGreaterThan(0);

    const db = store.getDb();
    for (const doc of docs) {
      const row = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?").get(doc.id) as { quality_score: number };
      expect(row.quality_score).toBeLessThanOrEqual(1.0);
    }
  });

  it("qualityDistribution shows variance across imports with different content", () => {
    // Short prose without keywords → low base score
    const proseContent = makeProse(100); // base = min(1.0, 100/500) = 0.2, no bonus
    indexPrdContent(ks, proseContent, "prose.md");

    // AC content with keywords → higher score
    const acContent = "GIVEN a user WHEN they login THEN they see the dashboard must pass shall comply";
    indexPrdContent(ks, acContent, "ac.md");

    const db = store.getDb();
    const allRows = db.prepare("SELECT quality_score FROM knowledge_documents").all() as Array<{ quality_score: number }>;

    const scores = allRows.map((r) => r.quality_score);
    expect(scores.length).toBeGreaterThanOrEqual(2);

    // Verify scores are not all the same — prose gets low score, AC gets higher
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    expect(max).toBeGreaterThan(min);
  });

  it("bonus applies for 'must' and 'shall' keywords", () => {
    const requirementChunk = "The system must respond within 200ms. It shall handle 1000 concurrent users.";
    indexPrdContent(ks, requirementChunk, "reqs.md");

    const docs = ks.getBySourceId("prd:reqs.md");
    expect(docs.length).toBeGreaterThan(0);

    const db = store.getDb();
    const row = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?").get(docs[0].id) as { quality_score: number };
    // Base score for ~72 chars = min(1.0, 72/500) = 0.144 + 0.2 bonus = 0.344 but capped behaviors
    // Either way: score should be > the base without bonus
    const baseScore = Math.min(1.0, requirementChunk.length / 500);
    expect(row.quality_score).toBeGreaterThan(baseScore);
  });
});

describe("InsertKnowledgeDoc — qualityScore field propagation", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("QualityScore Propagation Test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("persists qualityScore when explicitly provided to insert()", () => {
    const doc = ks.insert({
      sourceType: "prd",
      sourceId: "explicit-quality",
      title: "Test",
      content: "some content",
      qualityScore: 0.85,
    });

    const db = store.getDb();
    const row = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?").get(doc.id) as { quality_score: number };
    expect(row.quality_score).toBeCloseTo(0.85, 2);
  });

  it("uses 0.5 default when qualityScore is not provided", () => {
    const doc = ks.insert({
      sourceType: "prd",
      sourceId: "no-quality",
      title: "Test",
      content: "some content",
    });

    const db = store.getDb();
    const row = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?").get(doc.id) as { quality_score: number };
    // DB DEFAULT is 0.5
    expect(row.quality_score).toBeCloseTo(0.5, 2);
  });
});
