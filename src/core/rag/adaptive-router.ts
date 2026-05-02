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
 * Adaptive RAG Router — dynamically routes queries to different retrieval strategies
 * based on query complexity classification.
 *
 * Strategies:
 * - Simple queries (status, basic search) → FTS-only path (~3x faster)
 * - Moderate queries (how_to, filtered search) → FTS + Graph traversal
 * - Complex queries (debug, compare, multi-entity) → Full 6-strategy RRF pipeline
 *
 * Reduces latency for simple queries while improving quality for complex ones.
 */

import type { UnderstandingResult, QueryIntent } from "./query-understanding.js";
import { logger } from "../utils/logger.js";

export type QueryComplexity = "simple" | "moderate" | "complex";

export type StrategyName =
  | "fts"
  | "graph"
  | "recency"
  | "entity_graph"
  | "lsp"
  | "exec_graph"
  | "semantic"
  | "onnx_semantic";

export interface RoutingDecision {
  complexity: QueryComplexity;
  strategies: StrategyName[];
  tokenBudget: number;
  reason: string;
}

/** Intents that indicate simple informational queries. */
const SIMPLE_INTENTS: Set<QueryIntent> = new Set(["status", "history"]);

/** Intents that indicate complex analytical queries. */
const COMPLEX_INTENTS: Set<QueryIntent> = new Set(["debug", "compare"]);

/**
 * Classify query complexity based on intent, entity count, and source filters.
 *
 * Classification rules:
 * - simple: status/history intent, or search with ≤1 entity and no source filter
 * - moderate: how_to intent, or search with 2-3 entities, or has source filter
 * - complex: debug/compare intent, or >3 entities, or multi-source filter
 */
export function classifyComplexity(understood: UnderstandingResult): QueryComplexity {
  const { intent, entities, sourceTypeFilter } = understood;
  const entityCount = entities.length;
  const hasSourceFilter = sourceTypeFilter.length > 0;
  const multiSourceFilter = sourceTypeFilter.length > 1;

  // Complex: debug/compare intents are always complex
  if (COMPLEX_INTENTS.has(intent)) {
    return "complex";
  }

  // Complex: many entities or multiple source filters
  if (entityCount > 3 || multiSourceFilter) {
    return "complex";
  }

  // Simple: status/history intents
  if (SIMPLE_INTENTS.has(intent)) {
    return "simple";
  }

  // Moderate: how_to intent
  if (intent === "how_to") {
    return "moderate";
  }

  // Search intent: classify by entity count and filters
  if (intent === "search") {
    if (hasSourceFilter || entityCount >= 2) {
      return "moderate";
    }
    return "simple";
  }

  // Default: moderate
  return "moderate";
}

/** Strategy sets per complexity level. */
const STRATEGY_SETS: Record<QueryComplexity, StrategyName[]> = {
  simple: ["fts", "recency"],
  moderate: ["fts", "graph", "recency", "exec_graph", "semantic", "onnx_semantic"],
  complex: ["fts", "graph", "recency", "entity_graph", "lsp", "exec_graph", "semantic", "onnx_semantic"],
};

/** Token budgets per complexity level. */
const TOKEN_BUDGETS: Record<QueryComplexity, number> = {
  simple: 1500,
  moderate: 3000,
  complex: 6000,
};

/**
 * Route a query to the appropriate strategy subset based on complexity.
 * Returns a RoutingDecision with strategies, token budget, and reason.
 */
export function routeQuery(understood: UnderstandingResult): RoutingDecision {
  const complexity = classifyComplexity(understood);
  const strategies = STRATEGY_SETS[complexity];
  const tokenBudget = TOKEN_BUDGETS[complexity];

  const reason = buildReason(complexity, understood);

  logger.debug("adaptive-router: query routed", {
    query: understood.originalQuery.slice(0, 60),
    complexity,
    strategies: strategies.length,
    tokenBudget,
  });

  return {
    complexity,
    strategies,
    tokenBudget,
    reason,
  };
}

// ── Sub-query Decomposition ─────────────────────

export interface SubQuery {
  /** The decomposed sub-query text. */
  text: string;
  /** Source of this sub-query (entity, expanded term, or original). */
  source: string;
}

/**
 * Decompose a complex query into smaller sub-queries for parallel retrieval.
 *
 * Strategies:
 * - Entity-based: each extracted entity becomes a sub-query
 * - Source-filtered: split by source type filters
 * - Clause-based: split multi-clause queries on conjunctions
 *
 * Only used for complex queries. Simple/moderate queries return as-is.
 */
export function decomposeIntoSubQueries(understood: UnderstandingResult): SubQuery[] {
  const { originalQuery, entities, sourceTypeFilter } = understood;
  const complexity = classifyComplexity(understood);

  // Simple/moderate: no decomposition needed
  if (complexity !== "complex") {
    return [{ text: originalQuery, source: "original" }];
  }

  const subQueries: SubQuery[] = [];

  // Strategy 1: Entity-based sub-queries
  if (entities.length >= 2) {
    for (const entity of entities.slice(0, 4)) {
      subQueries.push({ text: entity, source: `entity:${entity}` });
    }
  }

  // Strategy 2: Source-filtered sub-queries
  if (sourceTypeFilter.length > 1) {
    for (const sourceType of sourceTypeFilter) {
      subQueries.push({
        text: `${originalQuery} ${sourceType}`,
        source: `source:${sourceType}`,
      });
    }
  }

  // Strategy 3: Clause-based decomposition (split on "and", "e", "with", "com")
  if (subQueries.length === 0) {
    const clauses = originalQuery.split(/\b(?:and|e|with|com|versus|vs)\b/i)
      .map((c) => c.trim())
      .filter((c) => c.length > 3);

    if (clauses.length >= 2) {
      for (const clause of clauses) {
        subQueries.push({ text: clause, source: "clause" });
      }
    }
  }

  // Always include original query as fallback
  if (subQueries.length === 0) {
    subQueries.push({ text: originalQuery, source: "original" });
  }

  logger.debug("adaptive-router: sub-query decomposition", {
    original: originalQuery.slice(0, 60),
    subQueryCount: subQueries.length,
  });

  return subQueries;
}

// ── Feedback Loop — Strategy Weight Adjustment ──

export interface StrategyPerformance {
  strategyName: StrategyName;
  /** Average score of results from this strategy. */
  avgScore: number;
  /** Number of results produced by this strategy. */
  resultCount: number;
  /** Average quality score of results from this strategy. */
  avgQuality: number;
}

/**
 * Compute per-strategy performance metrics from search results.
 * Used by the feedback loop to auto-adjust strategy weights.
 */
export function computeStrategyPerformance(
  results: Array<{ score: number; qualityScore: number; strategies: string[] }>,
): StrategyPerformance[] {
  const strategyStats = new Map<string, { totalScore: number; totalQuality: number; count: number }>();

  for (const resultValue of results) {
    for (const strategy of resultValue.strategies) {
      const existing = strategyStats.get(strategy) ?? { totalScore: 0, totalQuality: 0, count: 0 };
      existing.totalScore += resultValue.score;
      existing.totalQuality += resultValue.qualityScore;
      existing.count++;
      strategyStats.set(strategy, existing);
    }
  }

  const performance: StrategyPerformance[] = [];
  for (const [name, stats] of strategyStats) {
    performance.push({
      strategyName: name as StrategyName,
      avgScore: stats.count > 0 ? Math.round((stats.totalScore / stats.count) * 10000) / 10000 : 0,
      resultCount: stats.count,
      avgQuality: stats.count > 0 ? Math.round((stats.totalQuality / stats.count) * 10000) / 10000 : 0,
    });
  }

  performance.sort((a, b) => b.avgScore - a.avgScore);
  return performance;
}

/**
 * Build a human-readable routing reason.
 */
function buildReason(complexity: QueryComplexity, understood: UnderstandingResult): string {
  const { intent, entities, sourceTypeFilter } = understood;

  switch (complexity) {
    case "simple":
      return `Simple ${intent} query with ${entities.length} entities — FTS-only path`;
    case "moderate":
      return `Moderate ${intent} query with ${entities.length} entities${sourceTypeFilter.length > 0 ? ` and ${sourceTypeFilter.join(",")} filter` : ""} — FTS + graph path`;
    case "complex":
      return `Complex ${intent} query with ${entities.length} entities — full pipeline`;
  }
}
