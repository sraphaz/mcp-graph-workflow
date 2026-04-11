import { describe, it, expect } from "vitest";
import {
  classifyComplexity,
  routeQuery,
  decomposeIntoSubQueries,
  computeStrategyPerformance,
} from "../core/rag/adaptive-router.js";
import { understandQuery } from "../core/rag/query-understanding.js";

describe("Adaptive RAG Router", () => {
  describe("classifyComplexity", () => {
    it("should classify status queries as simple", () => {
      const understood = understandQuery("what is the status of authentication task?");
      const complexity = classifyComplexity(understood);
      expect(complexity).toBe("simple");
    });

    it("should classify basic search queries with few entities as simple", () => {
      const understood = understandQuery("find login");
      const complexity = classifyComplexity(understood);
      expect(complexity).toBe("simple");
    });

    it("should classify how_to queries as moderate", () => {
      const understood = understandQuery("how to implement JWT authentication?");
      const complexity = classifyComplexity(understood);
      expect(complexity).toBe("moderate");
    });

    it("should classify search queries with source filters as moderate", () => {
      const understood = understandQuery("search for database schema in code");
      const complexity = classifyComplexity(understood);
      expect(complexity).toBe("moderate");
    });

    it("should classify debug queries as complex", () => {
      const understood = understandQuery("why does the FTS5 search fail with special characters?");
      const complexity = classifyComplexity(understood);
      expect(complexity).toBe("complex");
    });

    it("should classify compare queries as complex", () => {
      const understood = understandQuery("compare BM25 vs TF-IDF ranking performance");
      const complexity = classifyComplexity(understood);
      expect(complexity).toBe("complex");
    });

    it("should classify queries with many entities as complex", () => {
      const understood = understandQuery(
        "how does GraphNode interact with SqliteStore and KnowledgeStore and EntityStore?",
      );
      const complexity = classifyComplexity(understood);
      expect(complexity).toBe("complex");
    });
  });

  describe("routeQuery", () => {
    it("should route simple queries to fast FTS-only path", () => {
      const understood = understandQuery("status of sprint 3");
      const decision = routeQuery(understood);

      expect(decision.complexity).toBe("simple");
      expect(decision.strategies).toContain("fts");
      expect(decision.strategies.length).toBeLessThanOrEqual(2);
      expect(decision.tokenBudget).toBeLessThanOrEqual(2000);
    });

    it("should route moderate queries to FTS + graph strategies", () => {
      const understood = understandQuery("how to implement the search module?");
      const decision = routeQuery(understood);

      expect(decision.complexity).toBe("moderate");
      expect(decision.strategies).toContain("fts");
      expect(decision.strategies).toContain("graph");
      expect(decision.tokenBudget).toBeGreaterThan(2000);
      expect(decision.tokenBudget).toBeLessThanOrEqual(4000);
    });

    it("should route complex queries to full strategy pipeline", () => {
      const understood = understandQuery("why does the BM25 search fail with unicode characters?");
      const decision = routeQuery(understood);

      expect(decision.complexity).toBe("complex");
      expect(decision.strategies.length).toBeGreaterThanOrEqual(4);
      expect(decision.tokenBudget).toBeGreaterThanOrEqual(4000);
    });

    it("should include a human-readable reason in the decision", () => {
      const understood = understandQuery("find tasks");
      const decision = routeQuery(understood);

      expect(decision.reason).toBeTruthy();
      expect(typeof decision.reason).toBe("string");
    });
  });

  describe("decomposeIntoSubQueries", () => {
    it("should not decompose simple queries", () => {
      const understood = understandQuery("status of sprint 3");
      const subQueries = decomposeIntoSubQueries(understood);

      expect(subQueries.length).toBe(1);
      expect(subQueries[0].source).toBe("original");
    });

    it("should decompose complex queries with multiple entities", () => {
      const understood = understandQuery(
        "why does GraphNode interact with SqliteStore and KnowledgeStore and EntityStore?",
      );
      const subQueries = decomposeIntoSubQueries(understood);

      expect(subQueries.length).toBeGreaterThan(1);
      expect(subQueries.some((q) => q.source.startsWith("entity:"))).toBe(true);
    });

    it("should decompose clause-based queries with conjunctions", () => {
      const understood = understandQuery(
        "compare authentication and authorization error handling",
      );
      const subQueries = decomposeIntoSubQueries(understood);

      expect(subQueries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("computeStrategyPerformance", () => {
    it("should compute per-strategy metrics from results", () => {
      const results = [
        { score: 0.9, qualityScore: 0.8, strategies: ["fts", "graph"] },
        { score: 0.7, qualityScore: 0.6, strategies: ["fts"] },
        { score: 0.5, qualityScore: 0.9, strategies: ["graph", "exec_graph"] },
      ];

      const perf = computeStrategyPerformance(results);

      expect(perf.length).toBeGreaterThanOrEqual(2);

      const ftsPerf = perf.find((p) => p.strategyName === "fts");
      expect(ftsPerf).toBeDefined();
      expect(ftsPerf!.resultCount).toBe(2);
      expect(ftsPerf!.avgScore).toBeGreaterThan(0);
    });

    it("should handle empty results", () => {
      const perf = computeStrategyPerformance([]);
      expect(perf).toHaveLength(0);
    });

    it("should sort by avgScore descending", () => {
      const results = [
        { score: 0.9, qualityScore: 0.8, strategies: ["fts"] },
        { score: 0.3, qualityScore: 0.4, strategies: ["recency"] },
      ];

      const perf = computeStrategyPerformance(results);
      expect(perf[0].avgScore).toBeGreaterThanOrEqual(perf[perf.length - 1].avgScore);
    });
  });
});
