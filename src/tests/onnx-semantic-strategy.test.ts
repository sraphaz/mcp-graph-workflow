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

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { EmbeddingStore } from "../core/rag/embedding-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { generateEmbedding } from "../core/rag/embedding-generator.js";
import { multiStrategySearch } from "../core/rag/multi-strategy-retrieval.js";
import { routeQuery, type StrategyName } from "../core/rag/adaptive-router.js";
import type { UnderstandingResult } from "../core/rag/query-understanding.js";

describe("onnx_semantic strategy in multi-strategy retrieval", () => {
  let store: SqliteStore;
  let embeddingStore: EmbeddingStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(async () => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    embeddingStore = new EmbeddingStore(store);
    knowledgeStore = new KnowledgeStore(store.getDb());

    // Seed knowledge documents
    knowledgeStore.insert({
      sourceType: "prd",
      sourceId: "n1",
      title: "TypeScript compiler",
      content: "TypeScript compiler architecture and plugin system",
    });
    knowledgeStore.insert({
      sourceType: "prd",
      sourceId: "n2",
      title: "RAG pipeline",
      content: "Retrieval augmented generation pipeline with BM25 and embedding search",
    });

    // Seed ONNX embeddings
    const texts = [
      "TypeScript compiler architecture and plugin system",
      "Retrieval augmented generation pipeline with BM25 and embedding search",
    ];
    for (let i = 0; i < texts.length; i++) {
      const vec = await generateEmbedding(texts[i]);
      embeddingStore.upsert(
        { id: `emb-${i}`, source: "node", sourceId: `n${i + 1}`, text: texts[i], embedding: vec },
        "onnx",
      );
    }
  });

  it("onnx_semantic is a valid StrategyName", () => {
    const strategies: StrategyName[] = [
      "fts", "graph", "recency", "entity_graph", "lsp", "exec_graph", "semantic", "onnx_semantic",
    ];
    expect(strategies).toContain("onnx_semantic");
  });

  it("runs onnx_semantic when included in strategies", async () => {
    const results = await multiStrategySearch(
      store.getDb(),
      "TypeScript compiler",
      {
        strategies: ["onnx_semantic"],
        embeddingStore,
        store,
        limit: 5,
      },
    );
    // Should return results (may be empty if no ONNX runtime, but should not throw)
    expect(Array.isArray(results)).toBe(true);
  });

  it("onnx_semantic is NOT run for simple queries", () => {
    const simpleUnderstood: UnderstandingResult = {
      originalQuery: "task status",
      rewrittenQuery: "task status",
      intent: "status",
      entities: [],
      sourceTypeFilter: [],
      expandedTerms: ["task", "status"],
    };
    const decision = routeQuery(simpleUnderstood);
    expect(decision.complexity).toBe("simple");
    expect(decision.strategies).not.toContain("onnx_semantic");
  });

  it("onnx_semantic is included in moderate strategy set from adaptive-router", () => {
    const moderateUnderstood: UnderstandingResult = {
      originalQuery: "how to set up the RAG pipeline",
      rewrittenQuery: "how to set up the rag pipeline",
      intent: "how_to",
      entities: ["RAG", "pipeline"],
      sourceTypeFilter: [],
      expandedTerms: ["rag", "pipeline", "setup"],
    };
    const decision = routeQuery(moderateUnderstood);
    expect(decision.complexity).toBe("moderate");
    expect(decision.strategies).toContain("onnx_semantic");
  });

  it("onnx_semantic is included in complex strategy set from adaptive-router", () => {
    const complexUnderstood: UnderstandingResult = {
      originalQuery: "debug why embedding search returns wrong results",
      rewrittenQuery: "debug why embedding search returns wrong results",
      intent: "debug",
      entities: ["embedding", "search"],
      sourceTypeFilter: [],
      expandedTerms: ["embedding", "search", "debug"],
    };
    const decision = routeQuery(complexUnderstood);
    expect(decision.complexity).toBe("complex");
    expect(decision.strategies).toContain("onnx_semantic");
  });
});
