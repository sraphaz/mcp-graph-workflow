/**
 * Tests for challenge-indexer.ts — Challenge History Indexer.
 *
 * Task 4.1 (node_df89a15f8e14) — Epic: Knowledge & Alternatives
 *
 * AC1: Index challenge report into KnowledgeStore with correct metadata
 * AC2: Indexed challenges retrievable via search (BM25)
 * AC3: Multiple challenges ordered by relevance
 */

import { describe, it, expect } from "vitest";
import {
  indexChallengeReport,
  searchChallengeHistory,
  type ChallengeReport,
} from "../core/rag/challenge-indexer.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { SqliteStore } from "../core/store/sqlite-store.js";

function makeReport(overrides: Partial<ChallengeReport> = {}): ChallengeReport {
  return {
    nodeId: "node_decision_001",
    title: "ADR-001: Use SQLite for storage",
    grade: "B",
    compositeScore: 72,
    friction: { score: 80, detectedKeywords: ["npm install"], justification: "1 friction indicator" },
    optimality: { score: 65, matchedJtbds: 2, unmatchedJtbds: 1 },
    reversibility: { score: 70, lockInKeywords: [], reversibleKeywords: ["feature flag"] },
    tags: ["storage", "database", "sqlite"],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("challenge-indexer", () => {
  // ── AC1: Index challenge report ──
  describe("indexChallengeReport", () => {
    it("should index a challenge report into KnowledgeStore with source 'challenge_report'", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-challenge");
      const ks = new KnowledgeStore(store.getDb());

      const report = makeReport();
      const doc = indexChallengeReport(ks, report);

      expect(doc.sourceType).toBe("challenge_report");
      expect(doc.sourceId).toBe("node_decision_001");
      expect(doc.title).toContain("ADR-001");

      store.close();
    });

    it("should include tags, nodeId, and timestamp in metadata", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-challenge");
      const ks = new KnowledgeStore(store.getDb());

      const report = makeReport({ tags: ["auth", "jwt"] });
      const doc = indexChallengeReport(ks, report);

      expect(doc.metadata).toBeDefined();
      expect(doc.metadata?.nodeId).toBe("node_decision_001");
      expect(doc.metadata?.tags).toEqual(["auth", "jwt"]);
      expect(doc.metadata?.grade).toBe("B");
      expect(doc.metadata?.compositeScore).toBe(72);

      store.close();
    });

    it("should include score details in content", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-challenge");
      const ks = new KnowledgeStore(store.getDb());

      const report = makeReport();
      const doc = indexChallengeReport(ks, report);

      expect(doc.content).toContain("Friction");
      expect(doc.content).toContain("Optimality");
      expect(doc.content).toContain("Reversibility");

      store.close();
    });

    it("should deduplicate identical reports", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-dedup");
      const ks = new KnowledgeStore(store.getDb());

      const report = makeReport();
      const doc1 = indexChallengeReport(ks, report);
      const doc2 = indexChallengeReport(ks, report);

      expect(doc1.id).toBe(doc2.id); // Same content → same doc
      expect(ks.count("challenge_report")).toBe(1);

      store.close();
    });
  });

  // ── AC2: Searchable via BM25 ──
  describe("searchChallengeHistory", () => {
    it("should find indexed challenges via keyword search", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-search");
      const ks = new KnowledgeStore(store.getDb());

      indexChallengeReport(ks, makeReport({
        nodeId: "n1",
        title: "ADR-001: Use SQLite for storage",
        tags: ["storage", "sqlite"],
      }));
      indexChallengeReport(ks, makeReport({
        nodeId: "n2",
        title: "ADR-002: JWT for authentication",
        tags: ["auth", "jwt"],
      }));

      const results = searchChallengeHistory(ks, "sqlite storage");

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].sourceId).toBe("n1");

      store.close();
    });
  });

  // ── AC3: Ordered by relevance ──
  describe("ordering by relevance", () => {
    it("should return more relevant challenges first", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-relevance");
      const ks = new KnowledgeStore(store.getDb());

      indexChallengeReport(ks, makeReport({
        nodeId: "n1",
        title: "ADR-001: Redis caching layer",
        tags: ["cache", "redis"],
      }));
      indexChallengeReport(ks, makeReport({
        nodeId: "n2",
        title: "ADR-002: SQLite database storage engine",
        tags: ["database", "sqlite", "storage"],
      }));
      indexChallengeReport(ks, makeReport({
        nodeId: "n3",
        title: "ADR-003: SQLite FTS5 search index for database queries",
        tags: ["database", "sqlite", "search", "fts"],
      }));

      const results = searchChallengeHistory(ks, "sqlite database");

      expect(results.length).toBeGreaterThanOrEqual(2);
      // sqlite+database matches should be ranked above redis
      expect(results[0].sourceId).not.toBe("n1");

      store.close();
    });
  });
});
