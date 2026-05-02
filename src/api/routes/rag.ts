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
 * RAG API routes — semantic search endpoint.
 * Uses local embeddings for token-efficient retrieval.
 */

import { Router } from "express";
import { z } from "zod/v4";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { StoreRef } from "../../core/store/store-manager.js";
import { EmbeddingStore } from "../../core/rag/embedding-store.js";
import { indexAllEmbeddings, semanticSearch } from "../../core/rag/rag-pipeline.js";
import { logger } from "../../core/utils/logger.js";

const RagQuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

/** createRagRouter — auto-generated description placeholder. */
export function createRagRouter(storeRef: StoreRef): Router {
  const router = Router();

  /** Lazy embedding store — re-creates when the underlying store changes. */
  let _cachedStore: SqliteStore = storeRef.current;
  let _embeddingStore: EmbeddingStore = new EmbeddingStore(_cachedStore);
  let indexed = false;

  function getEmbeddingStore(): EmbeddingStore {
    if (_cachedStore !== storeRef.current) {
      _cachedStore = storeRef.current;
      _embeddingStore = new EmbeddingStore(_cachedStore);
      indexed = false;
    }
    return _embeddingStore;
  }

  // ── POST /query — semantic search ─────────────
  router.post("/query", async (req, res, next) => {
    try {
      const parsed = RagQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Missing required field: query" });
        return;
      }

      const { query, limit } = parsed.data;
      const embeddingStore = getEmbeddingStore();

      // Lazy index on first query — indexes nodes + knowledge docs
      if (!indexed) {
        const resultValue = await indexAllEmbeddings(storeRef.current, embeddingStore);
        indexed = (resultValue.nodes + resultValue.knowledge) > 0;
        logger.info("RAG index built on first query", { nodes: resultValue.nodes, knowledge: resultValue.knowledge });
      }

      const results = await semanticSearch(embeddingStore, query, limit ?? 10);

      res.json({
        query,
        results: results.map((r) => ({
          id: r.sourceId,
          text: r.text,
          similarity: Math.round(r.similarity * 1000) / 1000,
          source: r.source,
        })),
        totalIndexed: embeddingStore.count(),
      });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /reindex — rebuild embeddings ────────
  router.post("/reindex", async (_req, res, next) => {
    try {
      const embeddingStore = getEmbeddingStore();
      embeddingStore.clear();
      const resultValue = await indexAllEmbeddings(storeRef.current, embeddingStore);
      indexed = (resultValue.nodes + resultValue.knowledge) > 0;

      res.json({ ok: true, indexed: resultValue.nodes + resultValue.knowledge, nodes: resultValue.nodes, knowledge: resultValue.knowledge });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /stats — embedding stats ──────────────
  router.get("/stats", (_req, res) => {
    const embeddingStore = getEmbeddingStore();
    res.json({
      totalEmbeddings: embeddingStore.count(),
      indexed,
    });
  });

  return router;
}
