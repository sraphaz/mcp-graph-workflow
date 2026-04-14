import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { suggestAlternatives } from "../core/designer/alternative-suggester.js";
import { indexChallengeReport } from "../core/rag/challenge-indexer.js";
import type { AlternativeSuggestion } from "../core/designer/alternative-suggester.js";
import type { ChallengeReport as IndexerReport } from "../core/rag/challenge-indexer.js";

function makeReport(overrides: Partial<IndexerReport> = {}): IndexerReport {
  return {
    nodeId: "node_failing",
    title: "Use MongoDB for sessions",
    grade: "D",
    compositeScore: 35,
    friction: { score: 30, detectedKeywords: ["vendor-lock", "complex"], justification: "High friction" },
    optimality: { score: 40, matchedJtbds: 1, unmatchedJtbds: 3 },
    reversibility: { score: 35, lockInKeywords: ["proprietary"], reversibleKeywords: [] },
    tags: ["database", "sessions"],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makePassedReport(overrides: Partial<IndexerReport> = {}): IndexerReport {
  return {
    nodeId: "node_passed",
    title: "Use Redis for sessions",
    grade: "A",
    compositeScore: 85,
    friction: { score: 90, detectedKeywords: [], justification: "Low friction" },
    optimality: { score: 80, matchedJtbds: 4, unmatchedJtbds: 0 },
    reversibility: { score: 85, lockInKeywords: [], reversibleKeywords: ["standard-protocol", "open-source"] },
    tags: ["database", "sessions", "cache"],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("suggestAlternatives", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Alt Suggester Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty array when no challenge history exists", () => {
    const failedReport = makeReport();
    const result = suggestAlternatives(failedReport, knowledgeStore);
    expect(result).toEqual([]);
  });

  it("should suggest alternatives from passed challenges with similar tags", () => {
    // Index a passed challenge with similar tags
    indexChallengeReport(knowledgeStore, makePassedReport());

    const failedReport = makeReport();
    const result = suggestAlternatives(failedReport, knowledgeStore);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const alt = result[0] as AlternativeSuggestion;
    expect(alt.title).toBeDefined();
    expect(alt.sourceNodeId).toBe("node_passed");
    expect(alt.estimatedScore).toBeGreaterThan(failedReport.compositeScore);
  });

  it("should include score delta in each suggestion", () => {
    indexChallengeReport(knowledgeStore, makePassedReport());

    const failedReport = makeReport({ compositeScore: 35 });
    const result = suggestAlternatives(failedReport, knowledgeStore);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const alt = result[0] as AlternativeSuggestion;
    expect(alt.scoreDelta).toBeDefined();
    expect(alt.scoreDelta.composite).toBe(alt.estimatedScore - 35);
  });

  it("should include dimension-level deltas (friction, optimality, reversibility)", () => {
    indexChallengeReport(knowledgeStore, makePassedReport());

    const failedReport = makeReport();
    const result = suggestAlternatives(failedReport, knowledgeStore);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const alt = result[0] as AlternativeSuggestion;
    expect(typeof alt.scoreDelta.friction).toBe("number");
    expect(typeof alt.scoreDelta.optimality).toBe("number");
    expect(typeof alt.scoreDelta.reversibility).toBe("number");
  });

  it("should not suggest alternatives that also failed (score < 60)", () => {
    // Index another failed challenge
    indexChallengeReport(knowledgeStore, makeReport({
      nodeId: "node_also_failed",
      title: "Use DynamoDB for sessions",
      compositeScore: 40,
      grade: "D",
    }));

    const failedReport = makeReport();
    const result = suggestAlternatives(failedReport, knowledgeStore);

    // Should not include the other failing decision
    const failedAlt = result.find((a: AlternativeSuggestion) => a.sourceNodeId === "node_also_failed");
    expect(failedAlt).toBeUndefined();
  });

  it("should rank alternatives by estimated score descending", () => {
    indexChallengeReport(knowledgeStore, makePassedReport({
      nodeId: "node_good",
      title: "Use Redis",
      compositeScore: 80,
    }));
    indexChallengeReport(knowledgeStore, makePassedReport({
      nodeId: "node_great",
      title: "Use Memcached",
      compositeScore: 95,
    }));

    const failedReport = makeReport();
    const result = suggestAlternatives(failedReport, knowledgeStore);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].estimatedScore).toBeGreaterThanOrEqual(result[1].estimatedScore);
  });

  it("should not suggest the same node as the failed decision", () => {
    // Index the failing decision itself as history
    indexChallengeReport(knowledgeStore, makeReport());

    const failedReport = makeReport();
    const result = suggestAlternatives(failedReport, knowledgeStore);

    const selfRef = result.find((a: AlternativeSuggestion) => a.sourceNodeId === "node_failing");
    expect(selfRef).toBeUndefined();
  });
});
