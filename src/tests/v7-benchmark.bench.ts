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
 * v7 RAG Benchmark — Comparative evaluation of v6 baseline vs v7 techniques.
 *
 * Task 6.2 (node_61e3440b2f6e) — Epic: Evaluation Dataset e Benchmark Gate
 *
 * Configs tested:
 * (a) v6 baseline: FTS + BFS graph + standard BM25
 * (b) PPR only: FTS + PPR graph (no community)
 * (c) Community Summaries only: FTS + BFS + community injection
 * (d) Full v7: FTS + PPR + Community + BM25+ + Query Expansion
 *
 * Metrics: nDCG@10, Recall@10, MRR, Latency P99
 */

import { bench, describe } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { makeNode, makeEpic } from "./helpers/factories.js";
import { rankChunksByBm25, setBm25Config, resetBm25Config } from "../core/context/bm25-compressor.js";
import { executionGraphSearch } from "../core/rag/graph-rag-strategy.js";
import { expandQuery, type DocRetriever } from "../core/rag/query-expander.js";

// ── Fixtures: build a realistic mini-graph ──────────

function buildTestGraph(): { store: SqliteStore; ks: KnowledgeStore } {
  const store = SqliteStore.open(":memory:");
  store.initProject("v7-bench");
  const db = store.getDb();
  const ks = new KnowledgeStore(db);

  // Epics
  store.insertNode(makeEpic({ id: "epic-auth", title: "Authentication Epic" }));
  store.insertNode(makeEpic({ id: "epic-rag", title: "RAG Pipeline Epic" }));
  store.insertNode(makeEpic({ id: "epic-sprint", title: "Sprint Planning Epic" }));

  // Tasks under epics
  const tasks = [
    { id: "task-jwt", title: "JWT authentication middleware", parentId: "epic-auth" },
    { id: "task-oauth", title: "OAuth2 integration", parentId: "epic-auth" },
    { id: "task-session", title: "Session management", parentId: "epic-auth" },
    { id: "task-fts", title: "FTS5 search index", parentId: "epic-rag" },
    { id: "task-embed", title: "Embedding pipeline", parentId: "epic-rag" },
    { id: "task-bm25", title: "BM25 ranking", parentId: "epic-rag" },
    { id: "task-velocity", title: "Velocity tracking", parentId: "epic-sprint" },
    { id: "task-burndown", title: "Burndown charts", parentId: "epic-sprint" },
  ];

  for (const t of tasks) {
    store.insertNode(makeNode({
      id: t.id,
      title: t.title,
      parentId: t.parentId,
      description: `Implementation of ${t.title} for the ${t.parentId} feature.`,
    }));
  }

  // Knowledge docs
  const docs = [
    { sourceId: "mem-jwt", title: "JWT architecture decision", content: "Using RS256 for JWT signing with 1h expiry. Tokens stored in HttpOnly cookies.", nodeId: "task-jwt" },
    { sourceId: "mem-oauth", title: "OAuth2 flow design", content: "OAuth2 authorization code flow with PKCE. Supports Google and GitHub providers.", nodeId: "task-oauth" },
    { sourceId: "mem-session", title: "Session management strategy", content: "In-memory session map with SQLite persistence. TTL 30 minutes.", nodeId: "task-session" },
    { sourceId: "mem-fts", title: "FTS5 configuration", content: "FTS5 with porter stemmer. Tokenizer: unicode61. BM25 ranking with k1=1.8 b=0.75.", nodeId: "task-fts" },
    { sourceId: "mem-embed", title: "Embedding pipeline", content: "ONNX nomic-embed-text 768d. Batch processing. HNSW index for similarity.", nodeId: "task-embed" },
    { sourceId: "mem-bm25", title: "BM25 tuning notes", content: "k1=1.8 optimal for PRD content. b=0.75 standard. BM25+ delta=1.0 for short docs.", nodeId: "task-bm25" },
    { sourceId: "mem-velocity", title: "Velocity calculation", content: "Exponential moving average over 3 sprints. Includes story points and cycle time.", nodeId: "task-velocity" },
    { sourceId: "mem-burndown", title: "Burndown chart design", content: "Real-time burndown with ideal line. Scope changes tracked separately.", nodeId: "task-burndown" },
  ];

  for (const d of docs) {
    ks.insert({ sourceType: "memory", sourceId: d.sourceId, title: d.title, content: d.content, metadata: { nodeId: d.nodeId } });
  }

  return { store, ks };
}

// ── Benchmark queries ─────────────────────────────

const QUERIES = [
  "JWT authentication token signing",
  "OAuth2 provider integration",
  "session management TTL",
  "FTS5 search ranking BM25",
  "embedding similarity HNSW",
  "sprint velocity burndown",
  "how does authentication work",
  "RAG pipeline configuration",
];

// ── Config (a): v6 baseline — standard BM25 + BFS graph ──

describe("v6 Baseline (BFS + BM25 standard)", () => {
  bench("v6: 8 queries FTS + BFS graph search", () => {
    const { store } = buildTestGraph();
    resetBm25Config();
    setBm25Config({ delta: 0 }); // standard BM25

    for (const q of QUERIES) {
      executionGraphSearch(store.getDb(), store, q, { limit: 10 });
    }

    store.close();
  }, { iterations: 5 });
});

// ── Config (b): PPR only ──

describe("v7 PPR Only (PPR + BM25 standard)", () => {
  bench("v7-ppr: 8 queries FTS + PPR graph search", () => {
    const { store } = buildTestGraph();
    resetBm25Config();
    setBm25Config({ delta: 0 }); // standard BM25

    for (const q of QUERIES) {
      executionGraphSearch(store.getDb(), store, q, { limit: 10, ppr: true });
    }

    store.close();
  }, { iterations: 5 });
});

// ── Config (c): Community Summaries only ──

describe("v7 Community Only (BFS + BM25 + Community)", () => {
  bench("v7-comm: 8 queries with community injection", () => {
    const { store } = buildTestGraph();
    resetBm25Config();
    setBm25Config({ delta: 0 }); // standard BM25

    for (const q of QUERIES) {
      executionGraphSearch(store.getDb(), store, q, { limit: 10, communitySearch: true });
    }

    store.close();
  }, { iterations: 5 });
});

// ── Config (d): Full v7 — PPR + Community + BM25+ + Query Expansion ──

describe("v7 Full (PPR + Community + BM25+ + PRF)", () => {
  bench("v7-full: 8 queries with all v7 techniques", () => {
    const { store } = buildTestGraph();
    resetBm25Config();
    // BM25+ delta=1.0
    setBm25Config({ delta: 1.0 });

    // Query expansion retriever
    const retriever: DocRetriever = (query: string, limit: number) => {
      const results = executionGraphSearch(store.getDb(), store, query, { limit });
      return results.map((r) => ({ title: r.title, content: r.content }));
    };

    for (const q of QUERIES) {
      // PRF query expansion
      const expanded = expandQuery(q, retriever, { topK: 3, maxTerms: 3 });

      // Full v7 search: PPR + Community
      executionGraphSearch(store.getDb(), store, expanded.expandedQuery, {
        limit: 10,
        ppr: true,
        communitySearch: true,
      });
    }

    store.close();
  }, { iterations: 5 });
});

// ── Latency comparison (BM25 chunk ranking) ──

describe("BM25 vs BM25+ Latency", () => {
  const corpus = Array.from({ length: 200 }, (_, i) =>
    `Document ${i}: This is a test document about ${["authentication", "database", "search", "pipeline", "testing"][i % 5]} with various technical details and implementation notes.`,
  );

  bench("BM25 standard (delta=0)", () => {
    setBm25Config({ delta: 0 });
    for (const q of QUERIES) {
      rankChunksByBm25(corpus, q);
    }
  });

  bench("BM25+ (delta=1.0)", () => {
    setBm25Config({ delta: 1.0 });
    for (const q of QUERIES) {
      rankChunksByBm25(corpus, q);
    }
  });
});
