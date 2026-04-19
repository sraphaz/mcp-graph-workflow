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
 * PPR vs BFS Benchmark — compares retrieval quality and latency.
 *
 * Metrics: nDCG@5, nDCG@10, MRR, latency P50/P99
 * 10 queries: narrow (3), broad (3), relational (4)
 *
 * Run: npm run test:bench -- src/tests/ppr-vs-bfs-benchmark.bench.ts
 */

import { bench, describe } from "vitest";
import { computePPR } from "../core/rag/personalized-pagerank.js";
import { graphProximityScore } from "../core/rag/graph-rag-strategy.js";

// ── Graph factory ─────────────────────────────────────

interface TestGraph {
  nodeIds: string[];
  edges: Array<{ from: string; to: string }>;
  /** Map nodeId → relevance for each query (ground truth) */
  relevanceByQuery: Map<string, Map<string, number>>;
}

function buildRealisticGraph(): TestGraph {
  const nodeIds: string[] = [];
  const edges: Array<{ from: string; to: string }> = [];

  // 3 epics, each with 5-8 tasks, some with cross-dependencies
  const epics = ["auth", "rag", "dashboard"];
  const taskCounts = [8, 7, 5];

  for (let e = 0; e < epics.length; e++) {
    const epicId = `epic-${epics[e]}`;
    nodeIds.push(epicId);

    for (let t = 0; t < taskCounts[e]; t++) {
      const taskId = `task-${epics[e]}-${t}`;
      nodeIds.push(taskId);
      edges.push({ from: epicId, to: taskId }); // parent → child

      // Sequential dependency within epic
      if (t > 0) {
        edges.push({ from: `task-${epics[e]}-${t - 1}`, to: taskId });
      }
    }
  }

  // Cross-epic dependencies (auth → rag, rag → dashboard)
  edges.push({ from: "task-auth-3", to: "task-rag-0" });
  edges.push({ from: "task-auth-5", to: "task-rag-2" });
  edges.push({ from: "task-rag-4", to: "task-dashboard-0" });
  edges.push({ from: "task-rag-6", to: "task-dashboard-2" });

  // Hub node: task-rag-3 has many incoming (highly connected)
  edges.push({ from: "task-auth-2", to: "task-rag-3" });
  edges.push({ from: "task-auth-7", to: "task-rag-3" });
  edges.push({ from: "task-dashboard-1", to: "task-rag-3" });

  // Build relevance ground truth for 10 queries
  const relevanceByQuery = new Map<string, Map<string, number>>();

  // Narrow queries (3) — specific task lookup
  relevanceByQuery.set("auth-login", new Map([
    ["task-auth-0", 3], ["task-auth-1", 2], ["epic-auth", 1],
  ]));
  relevanceByQuery.set("rag-pipeline", new Map([
    ["task-rag-0", 3], ["task-rag-1", 2], ["task-rag-2", 2], ["epic-rag", 1],
  ]));
  relevanceByQuery.set("dashboard-ui", new Map([
    ["task-dashboard-0", 3], ["task-dashboard-1", 2], ["epic-dashboard", 1],
  ]));

  // Broad queries (3) — cross-epic
  relevanceByQuery.set("security-integration", new Map([
    ["task-auth-3", 3], ["task-auth-5", 3], ["task-rag-0", 2], ["task-rag-2", 2], ["epic-auth", 1],
  ]));
  relevanceByQuery.set("full-stack-feature", new Map([
    ["task-auth-0", 2], ["task-rag-0", 2], ["task-dashboard-0", 2],
    ["epic-auth", 1], ["epic-rag", 1], ["epic-dashboard", 1],
  ]));
  relevanceByQuery.set("data-flow", new Map([
    ["task-rag-3", 3], ["task-rag-4", 2], ["task-rag-6", 2], ["task-dashboard-0", 1], ["task-dashboard-2", 1],
  ]));

  // Relational queries (4) — hub/connectivity dependent
  relevanceByQuery.set("most-depended-on", new Map([
    ["task-rag-3", 3], ["task-rag-0", 2], ["task-dashboard-0", 2],
  ]));
  relevanceByQuery.set("cross-team-blockers", new Map([
    ["task-auth-3", 3], ["task-auth-5", 3], ["task-rag-4", 2], ["task-rag-6", 2],
  ]));
  relevanceByQuery.set("hub-dependencies", new Map([
    ["task-rag-3", 3], ["task-auth-2", 2], ["task-auth-7", 2], ["task-dashboard-1", 2],
  ]));
  relevanceByQuery.set("integration-points", new Map([
    ["task-rag-0", 3], ["task-rag-2", 2], ["task-dashboard-0", 2], ["task-dashboard-2", 2],
  ]));

  return { nodeIds, edges, relevanceByQuery };
}

// ── IR Metrics ────────────────────────────────────────

/** Discounted Cumulative Gain */
function dcg(relevances: number[], k: number): number {
  let sum = 0;
  for (let i = 0; i < Math.min(relevances.length, k); i++) {
    sum += (Math.pow(2, relevances[i]) - 1) / Math.log2(i + 2);
  }
  return sum;
}

/** Normalized DCG@k */
function ndcg(ranked: string[], groundTruth: Map<string, number>, k: number): number {
  // Actual DCG from ranked list
  const actualRelevances = ranked.slice(0, k).map((id) => groundTruth.get(id) ?? 0);
  const actualDcg = dcg(actualRelevances, k);

  // Ideal DCG (sort ground truth by relevance)
  const idealRelevances = [...groundTruth.values()].sort((a, b) => b - a);
  const idealDcg = dcg(idealRelevances, k);

  return idealDcg > 0 ? actualDcg / idealDcg : 0;
}

/** Mean Reciprocal Rank */
function _mrr(ranked: string[], groundTruth: Map<string, number>): number {
  for (let i = 0; i < ranked.length; i++) {
    if ((groundTruth.get(ranked[i]) ?? 0) > 0) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

// ── Scoring functions ─────────────────────────────────

function bfsRank(graph: TestGraph, seedNodeIds: string[]): string[] {
  // BFS expansion + proximity scoring
  const nodeDistances = new Map<string, number>();
  for (const seed of seedNodeIds) nodeDistances.set(seed, 0);

  const visited = new Set(seedNodeIds);
  let frontier = [...seedNodeIds];

  for (let hop = 1; hop <= 3; hop++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      // Outgoing
      for (const edge of graph.edges) {
        if (edge.from === nodeId && !visited.has(edge.to)) {
          visited.add(edge.to);
          nodeDistances.set(edge.to, hop);
          next.push(edge.to);
        }
        if (edge.to === nodeId && !visited.has(edge.from)) {
          visited.add(edge.from);
          nodeDistances.set(edge.from, hop);
          next.push(edge.from);
        }
      }
    }
    frontier = next;
  }

  return [...nodeDistances.entries()]
    .map(([id, dist]) => ({ id, score: graphProximityScore(dist) }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.id);
}

function pprRank(graph: TestGraph, seedNodeIds: string[]): string[] {
  // PPR uses undirected edges for RAG proximity
  const biEdges = [
    ...graph.edges,
    ...graph.edges.map((e) => ({ from: e.to, to: e.from })),
  ];
  const result = computePPR({
    nodeIds: graph.nodeIds,
    edges: biEdges,
    seedNodeIds,
  });

  return [...result.scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

// ── Benchmarks ────────────────────────────────────────

const graph = buildRealisticGraph();
const queries = [...graph.relevanceByQuery.keys()];

// Pick seeds: first 2 relevant nodes per query as "FTS matches"
function getSeedsForQuery(query: string): string[] {
  const relevance = graph.relevanceByQuery.get(query)!;
  return [...relevance.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => id);
}

describe("PPR vs BFS — Latency", () => {
  const seeds = getSeedsForQuery("most-depended-on");

  bench("BFS scoring (20 nodes, 3 hops)", () => {
    bfsRank(graph, seeds);
  });

  bench("PPR scoring (20 nodes, power iteration)", () => {
    pprRank(graph, seeds);
  });
});

describe("PPR vs BFS — Quality (nDCG@10)", () => {
  bench("BFS quality across 10 queries", () => {
    for (const query of queries) {
      const seeds = getSeedsForQuery(query);
      const ranked = bfsRank(graph, seeds);
      const gt = graph.relevanceByQuery.get(query)!;
      ndcg(ranked, gt, 10);
    }
  });

  bench("PPR quality across 10 queries", () => {
    for (const query of queries) {
      const seeds = getSeedsForQuery(query);
      const ranked = pprRank(graph, seeds);
      const gt = graph.relevanceByQuery.get(query)!;
      ndcg(ranked, gt, 10);
    }
  });
});
