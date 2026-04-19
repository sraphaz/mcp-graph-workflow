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

/**
 * Tests for RAG evaluation dataset.
 *
 * AC1: Dataset produces nDCG@5, nDCG@10, Recall@5, Recall@10, MRR per category
 * AC2: 50 queries: 15 narrow, 15 broad, 10 relational, 10 temporal
 *      Each category has ground truth with >= 3 relevant docs
 */

import { describe, it, expect } from "vitest";
import {
  RAG_EVAL_DATASET,
  type QueryCategory,
} from "./fixtures/rag-eval-dataset.js";
import { computeNdcg, computeRecall, computeMrr } from "../core/rag/rag-eval.js";

describe("RAG evaluation dataset", () => {
  // AC2: 50 queries total
  it("should have exactly 50 queries", () => {
    expect(RAG_EVAL_DATASET.length).toBe(50);
  });

  // AC2: Category distribution
  it("should have 15 narrow, 15 broad, 10 relational, 10 temporal queries", () => {
    const counts: Record<QueryCategory, number> = { narrow: 0, broad: 0, relational: 0, temporal: 0 };
    for (const q of RAG_EVAL_DATASET) {
      counts[q.category]++;
    }
    expect(counts.narrow).toBe(15);
    expect(counts.broad).toBe(15);
    expect(counts.relational).toBe(10);
    expect(counts.temporal).toBe(10);
  });

  // AC2: Each category has ground truth with >= 3 relevant docs per query
  it("should have >= 3 relevant docs in ground truth for every query", () => {
    for (const q of RAG_EVAL_DATASET) {
      expect(q.relevantDocIds.length).toBeGreaterThanOrEqual(3);
    }
  });

  // AC2: All queries have non-empty fields
  it("should have valid query, source, and grades for every entry", () => {
    for (const q of RAG_EVAL_DATASET) {
      expect(q.query.length).toBeGreaterThan(0);
      expect(q.source.length).toBeGreaterThan(0);
      expect(q.grades.size).toBeGreaterThanOrEqual(3);
    }
  });

  // AC2: Grade values are valid (0-3)
  it("should have grade values between 0 and 3", () => {
    for (const q of RAG_EVAL_DATASET) {
      for (const grade of q.grades.values()) {
        expect(grade).toBeGreaterThanOrEqual(0);
        expect(grade).toBeLessThanOrEqual(3);
      }
    }
  });

  // AC1: Can compute metrics for each category
  it("should produce valid metrics when eval functions run on dataset", () => {
    const categories: QueryCategory[] = ["narrow", "broad", "relational", "temporal"];

    for (const cat of categories) {
      const queries = RAG_EVAL_DATASET.filter((q) => q.category === cat);
      expect(queries.length).toBeGreaterThan(0);

      for (const q of queries) {
        // Simulate ranked results = ground truth order (best case)
        const rankedIds = [...q.grades.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => id);

        const ndcg5 = computeNdcg(rankedIds, q.grades, 5);
        const ndcg10 = computeNdcg(rankedIds, q.grades, 10);
        const recall5 = computeRecall(rankedIds, new Set(q.relevantDocIds), 5);
        const recall10 = computeRecall(rankedIds, new Set(q.relevantDocIds), 10);
        const mrr = computeMrr(rankedIds, new Set(q.relevantDocIds));

        expect(ndcg5).toBeGreaterThanOrEqual(0);
        expect(ndcg5).toBeLessThanOrEqual(1);
        expect(ndcg10).toBeGreaterThanOrEqual(0);
        expect(ndcg10).toBeLessThanOrEqual(1);
        expect(recall5).toBeGreaterThanOrEqual(0);
        expect(recall10).toBeGreaterThanOrEqual(0);
        expect(mrr).toBeGreaterThan(0); // ideal ranking has first result relevant
      }
    }
  });

  // Unique query strings
  it("should have unique query strings", () => {
    const seen = new Set<string>();
    for (const q of RAG_EVAL_DATASET) {
      expect(seen.has(q.query)).toBe(false);
      seen.add(q.query);
    }
  });
});
