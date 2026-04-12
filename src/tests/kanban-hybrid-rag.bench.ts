/**
 * Benchmark: Kanban Metrics + Hybrid RAG Scoring
 *
 * Measures real performance of:
 * 1. Kanban metrics calculation (throughput, cycle time, lead time) with 100+ tasks
 * 2. Hybrid RAG scoring (BM25 + semantic strategy) vs BM25-only
 * 3. EmbeddingStore.findSimilarByText at various corpus sizes
 */

import { bench, describe } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { EmbeddingStore } from "../core/rag/embedding-store.js";
import { indexAllEmbeddings } from "../core/rag/rag-pipeline.js";
import { multiStrategySearch } from "../core/rag/multi-strategy-retrieval.js";
import { makeNode } from "./helpers/factories.js";
import { now } from "../core/utils/time.js";
import type { GraphDocument } from "../core/graph/graph-types.js";
import { buildKanbanBoard } from "../core/kanban/kanban-builder.js";

// ── Helpers ──────────────────────────────────────────────

function seedStore(store: SqliteStore, nodeCount: number): void {
  const statuses = ["backlog", "ready", "in_progress", "blocked", "done"] as const;
  const types = ["task", "subtask"] as const;

  for (let i = 0; i < nodeCount; i++) {
    const status = statuses[i % statuses.length];
    const type = types[i % types.length];
    const ts = now();
    store.insertNode(makeNode({
      id: `bench_n${i}`,
      title: `Benchmark task ${i} — ${["auth", "database", "API", "frontend", "testing"][i % 5]} module`,
      description: `Implementation of feature ${i} with acceptance criteria and test coverage`,
      status,
      type,
      priority: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      createdAt: ts,
      updatedAt: ts,
    }));
  }
}

function seedKnowledge(store: SqliteStore, docCount: number): void {
  const ks = new KnowledgeStore(store.getDb());
  const topics = [
    "JWT authentication RSA256 signing token expiry refresh rotation security",
    "PostgreSQL configuration connection pooling pg-pool database migrations WAL mode",
    "React component lifecycle hooks useState useEffect memo optimization performance",
    "Express middleware rate limiting CORS helmet security headers compression",
    "SQLite FTS5 full-text search BM25 ranking knowledge indexing retrieval",
    "TypeScript strict mode ESM modules Zod validation schema inference types",
    "GraphNode status transitions finite state machine backlog ready in_progress done",
    "Kanban board WIP limits swimlanes throughput cycle time lead time metrics",
    "RAG pipeline embeddings semantic search cosine similarity TF-IDF vectorization",
    "Sprint planning velocity estimation decomposition atomic tasks INVEST criteria",
  ];

  for (let i = 0; i < docCount; i++) {
    ks.insert({
      title: `Knowledge doc ${i}`,
      content: topics[i % topics.length] + ` document number ${i} with additional context about implementation details`,
      sourceType: "memory",
      sourceId: `bench_n${i % 100}`,
    });
  }
}

function buildDoc(store: SqliteStore): GraphDocument {
  return store.toGraphDocument();
}

// ── Benchmark Setup ──────────────────────────────────────

let store100: SqliteStore;
let store500: SqliteStore;
let embeddingStore100: EmbeddingStore;
let embeddingStore500: EmbeddingStore;
let doc100: GraphDocument;
let doc500: GraphDocument;

// Setup stores before benchmarks
function setupStores(): void {
  // 100-node store
  store100 = SqliteStore.open(":memory:");
  store100.initProject("Bench 100");
  seedStore(store100, 100);
  seedKnowledge(store100, 50);
  embeddingStore100 = new EmbeddingStore(store100);
  indexAllEmbeddings(store100, embeddingStore100);
  doc100 = buildDoc(store100);

  // 500-node store
  store500 = SqliteStore.open(":memory:");
  store500.initProject("Bench 500");
  seedStore(store500, 500);
  seedKnowledge(store500, 200);
  embeddingStore500 = new EmbeddingStore(store500);
  indexAllEmbeddings(store500, embeddingStore500);
  doc500 = buildDoc(store500);
}

setupStores();

// ── 1. Kanban Metrics Benchmark ──────────────────────────

describe("Kanban Metrics Calculation", () => {
  const defaultConfig = {
    wipLimits: { backlog: 0, ready: 5, in_progress: 3, blocked: 0, done: 0 },
    swimlaneMode: "none" as const,
    showOnlyTasks: true,
  };

  bench("100 tasks — build board + metrics", () => {
    buildKanbanBoard(doc100, defaultConfig);
  });

  bench("500 tasks — build board + metrics", () => {
    buildKanbanBoard(doc500, defaultConfig);
  });
});

// ── 2. Hybrid RAG Scoring Benchmark ──────────────────────

describe("Hybrid RAG: BM25-only vs BM25+Semantic", () => {
  bench("100 nodes — BM25 only (fts strategy)", () => {
    multiStrategySearch(store100.getDb(), "authentication JWT token", {
      limit: 10,
      store: store100,
      strategies: ["fts", "recency"],
    });
  });

  bench("100 nodes — Hybrid (fts + semantic)", () => {
    multiStrategySearch(store100.getDb(), "authentication JWT token", {
      limit: 10,
      store: store100,
      embeddingStore: embeddingStore100,
      strategies: ["fts", "recency", "semantic"],
    });
  });

  bench("500 nodes — BM25 only", () => {
    multiStrategySearch(store500.getDb(), "database PostgreSQL migration", {
      limit: 10,
      store: store500,
      strategies: ["fts", "recency"],
    });
  });

  bench("500 nodes — Hybrid (fts + semantic)", () => {
    multiStrategySearch(store500.getDb(), "database PostgreSQL migration", {
      limit: 10,
      store: store500,
      embeddingStore: embeddingStore500,
      strategies: ["fts", "recency", "semantic"],
    });
  });
});

// ── 3. Semantic Search Latency ───────────────────────────

describe("Semantic Search (findSimilarByText)", () => {
  bench("50 embeddings — text similarity", () => {
    embeddingStore100.findSimilarByText("authentication security tokens", 10);
  });

  bench("200 embeddings — text similarity", () => {
    embeddingStore500.findSimilarByText("database configuration pooling", 10);
  });
});
