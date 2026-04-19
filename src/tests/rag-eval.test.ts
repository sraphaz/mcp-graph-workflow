/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { makeNode } from "./helpers/factories.js";
import {
  computeNdcg,
  computeRecall,
  computePrecision,
  computeMrr,
  generateEvalDataset,
  runEvalBenchmark,
  type EvalQuery,
} from "../core/rag/rag-eval.js";

describe("RAG Eval", () => {
  // ── Pure metric functions ────────────────────────

  describe("computeNdcg", () => {
    it("should return 1.0 for perfect ranking", () => {
      const rankedIds = ["a", "b", "c"];
      const grades = new Map([["a", 3], ["b", 2], ["c", 1]]);
      const ndcg = computeNdcg(rankedIds, grades, 3);
      expect(ndcg).toBeCloseTo(1.0, 4);
    });

    it("should return less than 1.0 for suboptimal ranking", () => {
      // Reverse of ideal: worst items first
      const rankedIds = ["c", "b", "a"];
      const grades = new Map([["a", 3], ["b", 2], ["c", 1]]);
      const ndcg = computeNdcg(rankedIds, grades, 3);
      expect(ndcg).toBeGreaterThan(0);
      expect(ndcg).toBeLessThan(1.0);
    });

    it("should return 0 when no relevant docs are in results", () => {
      const rankedIds = ["x", "y", "z"];
      const grades = new Map([["a", 3], ["b", 2]]);
      const ndcg = computeNdcg(rankedIds, grades, 3);
      expect(ndcg).toBe(0);
    });

    it("should handle K larger than result list", () => {
      const rankedIds = ["a"];
      const grades = new Map([["a", 3], ["b", 2]]);
      const ndcg = computeNdcg(rankedIds, grades, 10);
      expect(ndcg).toBeGreaterThan(0);
      expect(ndcg).toBeLessThanOrEqual(1.0);
    });

    it("should handle empty grades map", () => {
      const ndcg = computeNdcg(["a", "b"], new Map(), 10);
      expect(ndcg).toBe(0);
    });
  });

  describe("computeRecall", () => {
    it("should return 1.0 when all relevant docs are found", () => {
      const rankedIds = ["a", "b", "c", "d"];
      const relevantIds = new Set(["a", "b"]);
      expect(computeRecall(rankedIds, relevantIds, 4)).toBe(1.0);
    });

    it("should return 0.5 when half of relevant docs are found", () => {
      const rankedIds = ["a", "x", "y"];
      const relevantIds = new Set(["a", "b"]);
      expect(computeRecall(rankedIds, relevantIds, 3)).toBe(0.5);
    });

    it("should return 0 when no relevant docs are found", () => {
      const rankedIds = ["x", "y", "z"];
      const relevantIds = new Set(["a", "b"]);
      expect(computeRecall(rankedIds, relevantIds, 3)).toBe(0);
    });

    it("should return 0 for empty relevant set", () => {
      expect(computeRecall(["a"], new Set(), 10)).toBe(0);
    });
  });

  describe("computePrecision", () => {
    it("should return 1.0 when all top K are relevant", () => {
      const rankedIds = ["a", "b"];
      const relevantIds = new Set(["a", "b"]);
      expect(computePrecision(rankedIds, relevantIds, 2)).toBe(1.0);
    });

    it("should return 0.5 when half of top K are relevant", () => {
      const rankedIds = ["a", "x"];
      const relevantIds = new Set(["a", "b"]);
      expect(computePrecision(rankedIds, relevantIds, 2)).toBe(0.5);
    });

    it("should return 0 for empty results", () => {
      expect(computePrecision([], new Set(["a"]), 10)).toBe(0);
    });
  });

  describe("computeMrr", () => {
    it("should return 1.0 when first result is relevant", () => {
      expect(computeMrr(["a", "b"], new Set(["a"]))).toBe(1.0);
    });

    it("should return 0.5 when second result is first relevant", () => {
      expect(computeMrr(["x", "a"], new Set(["a"]))).toBe(0.5);
    });

    it("should return 0 when no relevant results found", () => {
      expect(computeMrr(["x", "y"], new Set(["a"]))).toBe(0);
    });
  });

  // ── Integration with execution graph ─────────────

  describe("generateEvalDataset", () => {
    let store: SqliteStore;
    let ks: KnowledgeStore;

    beforeEach(() => {
      store = SqliteStore.open(":memory:");
      store.initProject("eval-test");
      ks = new KnowledgeStore(store.getDb());
    });

    afterEach(() => {
      store.close();
    });

    it("should generate eval queries from nodes with linked knowledge", () => {
      // Create node + linked knowledge
      store.insertNode(makeNode({
        id: "task-auth",
        title: "Implement JWT authentication",
        description: "Add JWT-based auth with RS256 signing",
      }));
      ks.insert({
        sourceType: "memory",
        sourceId: "mem:auth",
        title: "Auth decision",
        content: "Using JWT RS256 for authentication",
        metadata: { nodeId: "task-auth" },
      });

      const dataset = generateEvalDataset(store.getDb(), store);

      expect(dataset.length).toBeGreaterThanOrEqual(1);
      expect(dataset[0].query).toBe("Implement JWT authentication");
      expect(dataset[0].relevantDocIds.length).toBe(1);
      expect(dataset[0].grades.size).toBe(1);
    });

    it("should generate description-based queries when description is long enough", () => {
      store.insertNode(makeNode({
        id: "task-search",
        title: "Build search module",
        description: "Implement FTS5 full-text search with BM25 ranking and TF-IDF reranking",
      }));
      ks.insert({
        sourceType: "docs",
        sourceId: "docs:search",
        title: "Search docs",
        content: "FTS5 search implementation details",
        metadata: { nodeId: "task-search" },
      });

      const dataset = generateEvalDataset(store.getDb(), store);

      // Should have title-based query + description-based query
      expect(dataset.length).toBe(2);
      expect(dataset.some((q) => q.source.includes("node-desc"))).toBe(true);
    });

    it("should return empty dataset when no nodes have linked knowledge", () => {
      store.insertNode(makeNode({ title: "Orphan task" }));

      const dataset = generateEvalDataset(store.getDb(), store);
      expect(dataset).toHaveLength(0);
    });
  });

  describe("runEvalBenchmark", () => {
    let store: SqliteStore;
    let ks: KnowledgeStore;

    beforeEach(() => {
      store = SqliteStore.open(":memory:");
      store.initProject("benchmark-test");
      ks = new KnowledgeStore(store.getDb());
    });

    afterEach(() => {
      store.close();
    });

    it("should produce a valid eval report with per-query metrics", async () => {
      // Setup: node + knowledge
      store.insertNode(makeNode({
        id: "task-db",
        title: "Database schema design",
        description: "Design SQLite schema for graph storage",
      }));
      const doc = ks.insert({
        sourceType: "memory",
        sourceId: "mem:db",
        title: "DB schema decisions",
        content: "SQLite schema with FTS5 for nodes and knowledge_documents tables",
        metadata: { nodeId: "task-db" },
      });

      const queries: EvalQuery[] = [{
        query: "database schema SQLite",
        relevantDocIds: [doc!.id],
        grades: new Map([[doc!.id, 3]]),
        source: "manual",
      }];

      const report = await runEvalBenchmark(store.getDb(), store, queries, 10);

      expect(report.queryCount).toBe(1);
      expect(report.avgNdcg).toBeGreaterThanOrEqual(0);
      expect(report.avgNdcg).toBeLessThanOrEqual(1);
      expect(report.avgRecall).toBeGreaterThanOrEqual(0);
      expect(report.avgMrr).toBeGreaterThanOrEqual(0);
      expect(report.perQuery).toHaveLength(1);
    });

    it("should handle empty query list gracefully", async () => {
      const report = await runEvalBenchmark(store.getDb(), store, [], 10);

      expect(report.queryCount).toBe(0);
      expect(report.avgNdcg).toBe(0);
    });
  });
});
