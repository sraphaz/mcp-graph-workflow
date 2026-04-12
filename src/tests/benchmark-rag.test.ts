/**
 * Benchmark: RAG Pipeline — end-to-end latency SLOs per component.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { understandQuery } from "../core/rag/query-understanding.js";
import { SemanticCache } from "../core/rag/semantic-cache.js";
import { generateBudgetReport } from "../core/rag/token-budget-tracker.js";

describe("Benchmark: RAG Pipeline SLOs", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("rag-bench");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  function seedKnowledgeDocs(count: number): void {
    const types = ["docs", "memory", "ai_decision", "prd", "validation_result"] as const;
    for (let i = 0; i < count; i++) {
      ks.insert({
        sourceType: types[i % types.length],
        sourceId: `rag-${i}`,
        title: `Knowledge Doc ${i}: ${["Authentication", "Database", "API Design", "Testing", "Deployment"][i % 5]}`,
        content: `Detailed technical content about ${["OAuth2 flow", "SQLite optimization", "REST endpoints", "Vitest patterns", "Docker configuration"][i % 5]} with implementation details, best practices, and code examples for document ${i}`,
        metadata: { category: ["auth", "db", "api", "test", "deploy"][i % 5] },
      });
    }
  }

  // SLO 1: Query understanding < 5ms per query
  it("SLO-1: Query understanding < 5ms per query", () => {
    const queries = [
      "how to implement OAuth2 authentication",
      "what is the status of the deployment task",
      "debug the SQLite connection error",
      "compare REST vs GraphQL performance",
      "search for database optimization patterns",
      "show history of API changes",
    ];

    const iterations = 30;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      understandQuery(queries[i % queries.length]);
    }
    const elapsed = (performance.now() - start) / iterations;

    console.log(`[RAG-1] Query understanding: ${elapsed.toFixed(2)}ms avg`);
    expect(elapsed).toBeLessThan(5);
  });

  // SLO 2: Semantic cache lookup < 2ms
  it("SLO-2: Semantic cache lookup < 2ms", () => {
    const cache = new SemanticCache({ ttlMs: 60_000, maxEntries: 200 });

    // Store 50 results with dummy embeddings
    for (let i = 0; i < 50; i++) {
      const embedding = Array.from({ length: 10 }, (_, j) => i * 0.1 + j * 0.01);
      cache.set(`query-${i}`, embedding, { results: [`result-${i}`] });
    }

    // Lookup same 50
    let hits = 0;
    const iterations = 50;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = cache.getExact(`query-${i}`);
      if (result) hits++;
    }
    const elapsed = (performance.now() - start) / iterations;

    console.log(`[RAG-2] Cache lookup: ${elapsed.toFixed(2)}ms avg, hit rate: ${(hits / iterations * 100).toFixed(0)}%`);
    expect(elapsed).toBeLessThan(2);
    expect(hits / iterations).toBeGreaterThan(0.9);
  });

  // SLO 3: FTS search on knowledge docs < 20ms
  it("SLO-3: Knowledge FTS search at 500 docs < 20ms", () => {
    seedKnowledgeDocs(500);

    const iterations = 20;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      ks.search("authentication OAuth2 implementation");
    }
    const elapsed = (performance.now() - start) / iterations;

    console.log(`[RAG-3] Knowledge FTS@500: ${elapsed.toFixed(1)}ms avg`);
    expect(elapsed).toBeLessThan(20);
  });

  // SLO 4: Budget report generation < 10ms
  it("SLO-4: Budget report at 500 docs < 10ms", () => {
    seedKnowledgeDocs(500);

    const iterations = 10;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      generateBudgetReport(store.getDb(), 4000);
    }
    const elapsed = (performance.now() - start) / iterations;

    console.log(`[RAG-4] Budget report@500: ${elapsed.toFixed(1)}ms avg`);
    expect(elapsed).toBeLessThan(10);
  });

  // SLO 5: Intent detection accuracy > 80%
  it("SLO-5: Intent detection accuracy > 80%", () => {
    const testCases = [
      { query: "find all tasks about authentication", expectedIntent: "search" },
      { query: "how to implement JWT tokens", expectedIntent: "how_to" },
      { query: "what is the status of task-123", expectedIntent: "status" },
      { query: "debug the connection error in SQLite", expectedIntent: "debug" },
      { query: "compare BM25 vs TF-IDF scoring", expectedIntent: "compare" },
      { query: "show recent changes to the API", expectedIntent: "history" },
      { query: "search for deployment patterns", expectedIntent: "search" },
      { query: "how do I configure the RAG pipeline", expectedIntent: "how_to" },
      { query: "check progress of sprint-3", expectedIntent: "status" },
      { query: "fix the broken test in migration", expectedIntent: "debug" },
    ];

    let correct = 0;
    for (const tc of testCases) {
      const result = understandQuery(tc.query);
      if (result.intent === tc.expectedIntent) correct++;
    }

    const accuracy = correct / testCases.length;
    console.log(`[RAG-5] Intent accuracy: ${(accuracy * 100).toFixed(0)}% (${correct}/${testCases.length})`);
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
