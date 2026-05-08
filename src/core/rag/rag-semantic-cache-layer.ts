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
 * RAG Semantic Cache Layer — wraps SemanticCache + TfIdfVectorizer
 * for use in the context(rag) pipeline.
 *
 * The corpus is bounded (FIFO) and the TF-IDF vectorizer re-fit is throttled
 * (every N inserts) to prevent O(N²) CPU cost and unbounded RAM growth as the
 * layer is used across many queries and concurrent agents.
 */

import { SemanticCache, type SemanticCacheOptions } from "./semantic-cache.js";
import { TfIdfVectorizer } from "./rag-pipeline.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "rag", source: "rag-semantic-cache-layer.ts" });

export interface CacheHitResult {
  result: unknown;
  type: "exact" | "similar";
  _cache_hit: true;
}

export interface RagSemanticCacheLayerOptions {
  /** Max tokenized queries retained in the TF-IDF corpus. Default: 500. */
  maxCorpusSize?: number;
  /** Re-fit vectorizer every N inserts. Default: 50. */
  refitInterval?: number;
}

const DEFAULT_MAX_CORPUS_SIZE = 500;
const DEFAULT_REFIT_INTERVAL = 50;

export class RagSemanticCacheLayer {
  private readonly cache: SemanticCache;
  private readonly vectorizer: TfIdfVectorizer;
  private readonly corpus: string[][] = [];
  private readonly maxCorpusSize: number;
  private readonly refitInterval: number;
  private insertsSinceRefit = 0;
  private totalFits = 0;

  constructor(
    semanticOptions?: SemanticCacheOptions,
    layerOptions: RagSemanticCacheLayerOptions = {},
  ) {
    this.cache = new SemanticCache(semanticOptions);
    this.vectorizer = new TfIdfVectorizer();
    this.maxCorpusSize = layerOptions.maxCorpusSize ?? DEFAULT_MAX_CORPUS_SIZE;
    this.refitInterval = Math.max(1, layerOptions.refitInterval ?? DEFAULT_REFIT_INTERVAL);
  }

  /**
   * Store a query result in the semantic cache.
   * Appends query tokens to corpus (with FIFO cap) and re-fits the vectorizer
   * every `refitInterval` inserts rather than on every call.
   */
  store(query: string, result: unknown): void {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    this.corpus.push(tokens);
    if (this.corpus.length > this.maxCorpusSize) {
      this.corpus.splice(0, this.corpus.length - this.maxCorpusSize);
    }

    this.insertsSinceRefit++;
    if (this.insertsSinceRefit >= this.refitInterval) {
      this.vectorizer.fit(this.corpus);
      this.insertsSinceRefit = 0;
      this.totalFits++;
    }

    const embedding = this.vectorizer.embed(query);
    this.cache.set(query, embedding, result);

    log.debug("rag-semantic-cache:store", { query: query.slice(0, 50) });
  }

  /**
   * Look up a query in the cache.
   * First tries exact match, then falls back to similar match.
   * Returns null on cache miss.
   */
  lookup(query: string): CacheHitResult | null {
    const exact = this.cache.getExact(query);
    if (exact !== undefined) {
      log.debug("rag-semantic-cache:exact_hit", { query: query.slice(0, 50) });
      return { result: exact, type: "exact", _cache_hit: true };
    }

    const embedding = this.vectorizer.embed(query);
    const similar = this.cache.getSimilar(embedding);
    if (similar !== undefined) {
      log.debug("rag-semantic-cache:similar_hit", { query: query.slice(0, 50) });
      return { result: similar, type: "similar", _cache_hit: true };
    }

    return null;
  }

  /**
   * Return cache statistics.
   */
  stats(): { hits: number; misses: number; size: number } {
    return this.cache.stats();
  }

  /** Current corpus size (tokenized queries retained). For observability/tests. */
  corpusSize(): number {
    return this.corpus.length;
  }

  /** Total number of TF-IDF re-fits performed. For observability/tests. */
  fitCount(): number {
    return this.totalFits;
  }
}
