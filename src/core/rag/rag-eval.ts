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
 * RAG Evaluation — measures retrieval quality with nDCG@10 and recall metrics.
 *
 * Provides:
 * - Synthetic eval dataset generation from execution graph
 * - nDCG@10 scoring for ranked results
 * - Recall@K measurement
 * - Benchmark runner for A/B comparisons
 */

import type Database from "better-sqlite3";
import type { SqliteStore } from "../store/sqlite-store.js";
import { multiStrategySearch } from "./multi-strategy-retrieval.js";
import { logger } from "../utils/logger.js";

export interface EvalQuery {
  /** Natural language query. */
  query: string;
  /** IDs of documents considered relevant (ground truth). */
  relevantDocIds: string[];
  /** Relevance grade per doc (0=irrelevant, 1=marginal, 2=relevant, 3=highly relevant). */
  grades: Map<string, number>;
  /** Source description for this query. */
  source: string;
}

export interface EvalMetrics {
  /** Normalized Discounted Cumulative Gain at K. */
  ndcgAtK: number;
  /** Recall at K (fraction of relevant docs found in top K). */
  recallAtK: number;
  /** Precision at K. */
  precisionAtK: number;
  /** Mean Reciprocal Rank (rank of first relevant result). */
  mrr: number;
  /** Number of results returned. */
  resultCount: number;
}

export interface EvalReport {
  queryCount: number;
  avgNdcg: number;
  avgRecall: number;
  avgPrecision: number;
  avgMrr: number;
  perQuery: Array<{ query: string; metrics: EvalMetrics }>;
}

// ── nDCG calculation ────────────────────────────

/**
 * Compute Discounted Cumulative Gain.
 * DCG = Σ (2^rel_i - 1) / log2(i + 2)  (0-indexed)
 */
function dcg(grades: number[]): number {
  let sum = 0;
  for (let i = 0; i < grades.length; i++) {
    sum += (Math.pow(2, grades[i]) - 1) / Math.log2(i + 2);
  }
  return sum;
}

/**
 * Compute nDCG@K for a ranked list of results.
 * @param rankedIds - IDs in ranked order (best first)
 * @param gradeMap - relevance grades per doc ID
 * @param k - cutoff position
 */
export function computeNdcg(
  rankedIds: string[],
  gradeMap: Map<string, number>,
  k: number = 10,
): number {
  // Actual DCG from the ranked results
  const actualGrades = rankedIds.slice(0, k).map((id) => gradeMap.get(id) ?? 0);
  const actualDcg = dcg(actualGrades);

  // Ideal DCG: sort all grades descending and take top K
  const allGrades = Array.from(gradeMap.values()).sort((a, b) => b - a).slice(0, k);
  const idealDcg = dcg(allGrades);

  if (idealDcg === 0) return 0;
  return actualDcg / idealDcg;
}

/**
 * Compute recall@K: fraction of relevant docs found in top K.
 */
export function computeRecall(
  rankedIds: string[],
  relevantIds: Set<string>,
  k: number = 10,
): number {
  if (relevantIds.size === 0) return 0;
  const topK = new Set(rankedIds.slice(0, k));
  let found = 0;
  for (const id of relevantIds) {
    if (topK.has(id)) found++;
  }
  return found / relevantIds.size;
}

/**
 * Compute precision@K: fraction of top K that are relevant.
 */
export function computePrecision(
  rankedIds: string[],
  relevantIds: Set<string>,
  k: number = 10,
): number {
  const topK = rankedIds.slice(0, k);
  if (topK.length === 0) return 0;
  let found = 0;
  for (const id of topK) {
    if (relevantIds.has(id)) found++;
  }
  return found / topK.length;
}

/**
 * Compute Mean Reciprocal Rank: 1/rank of first relevant result.
 */
export function computeMrr(
  rankedIds: string[],
  relevantIds: Set<string>,
): number {
  for (let i = 0; i < rankedIds.length; i++) {
    if (relevantIds.has(rankedIds[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

// ── Eval dataset generation ─────────────────────

/**
 * Generate synthetic eval queries from the execution graph.
 * Creates queries from node titles/descriptions and maps them to
 * knowledge docs linked via metadata.nodeId.
 */
export function generateEvalDataset(
  db: Database.Database,
  store: SqliteStore,
): EvalQuery[] {
  const queries: EvalQuery[] = [];

  // Get nodes that have linked knowledge docs
  const nodesWithDocs = db
    .prepare(
      `SELECT DISTINCT json_extract(metadata, '$.nodeId') AS nodeId
       FROM knowledge_documents
       WHERE json_extract(metadata, '$.nodeId') IS NOT NULL`,
    )
    .all() as Array<{ nodeId: string }>;

  for (const { nodeId } of nodesWithDocs) {
    const node = store.getNodeById(nodeId);
    if (!node) continue;

    // Find all knowledge docs linked to this node
    const linkedDocs = db
      .prepare(
        `SELECT id, source_type, title FROM knowledge_documents
         WHERE json_extract(metadata, '$.nodeId') = ?`,
      )
      .all(nodeId) as Array<{ id: string; source_type: string; title: string }>;

    if (linkedDocs.length === 0) continue;

    // Build grade map: direct links = grade 3, same source_type = grade 1
    const grades = new Map<string, number>();
    for (const doc of linkedDocs) {
      grades.set(doc.id, 3); // Directly linked = highly relevant
    }

    // Query from node title
    queries.push({
      query: node.title,
      relevantDocIds: linkedDocs.map((d) => d.id),
      grades,
      source: `node:${nodeId}`,
    });

    // Query from node description (if different enough)
    if (node.description && node.description.length > 20 && node.description !== node.title) {
      const descGrades = new Map(grades);
      queries.push({
        query: node.description.slice(0, 100),
        relevantDocIds: linkedDocs.map((d) => d.id),
        grades: descGrades,
        source: `node-desc:${nodeId}`,
      });
    }
  }

  logger.info("rag-eval: generated eval dataset", { queryCount: queries.length });
  return queries;
}

// ── Benchmark runner ────────────────────────────

/**
 * Run the eval dataset through the multi-strategy search pipeline
 * and compute aggregate metrics.
 */
export async function runEvalBenchmark(
  db: Database.Database,
  store: SqliteStore,
  queries: EvalQuery[],
  k: number = 10,
): Promise<EvalReport> {
  const perQuery: Array<{ query: string; metrics: EvalMetrics }> = [];

  for (const evalQuery of queries) {
    const results = await multiStrategySearch(db, evalQuery.query, { limit: k, store });
    const rankedIds = results.map((r) => r.id);
    const relevantSet = new Set(evalQuery.relevantDocIds);

    const metrics: EvalMetrics = {
      ndcgAtK: computeNdcg(rankedIds, evalQuery.grades, k),
      recallAtK: computeRecall(rankedIds, relevantSet, k),
      precisionAtK: computePrecision(rankedIds, relevantSet, k),
      mrr: computeMrr(rankedIds, relevantSet),
      resultCount: results.length,
    };

    perQuery.push({ query: evalQuery.query, metrics });
  }

  // Compute averages
  const n = perQuery.length || 1;
  const avgNdcg = perQuery.reduce((s, q) => s + q.metrics.ndcgAtK, 0) / n;
  const avgRecall = perQuery.reduce((s, q) => s + q.metrics.recallAtK, 0) / n;
  const avgPrecision = perQuery.reduce((s, q) => s + q.metrics.precisionAtK, 0) / n;
  const avgMrr = perQuery.reduce((s, q) => s + q.metrics.mrr, 0) / n;

  logger.info("rag-eval: benchmark complete", {
    queries: perQuery.length,
    avgNdcg: Math.round(avgNdcg * 1000) / 1000,
    avgRecall: Math.round(avgRecall * 1000) / 1000,
    avgPrecision: Math.round(avgPrecision * 1000) / 1000,
    avgMrr: Math.round(avgMrr * 1000) / 1000,
  });

  return {
    queryCount: perQuery.length,
    avgNdcg: Math.round(avgNdcg * 10000) / 10000,
    avgRecall: Math.round(avgRecall * 10000) / 10000,
    avgPrecision: Math.round(avgPrecision * 10000) / 10000,
    avgMrr: Math.round(avgMrr * 10000) / 10000,
    perQuery,
  };
}
