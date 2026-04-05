/**
 * RAG Semantic Cache Layer — wraps SemanticCache + TfIdfVectorizer
 * for use in the rag_context tool pipeline.
 */

import { SemanticCache, type SemanticCacheOptions } from "./semantic-cache.js";
import { TfIdfVectorizer } from "./rag-pipeline.js";
import { logger } from "../utils/logger.js";

export interface CacheHitResult {
  result: unknown;
  type: "exact" | "similar";
  _cache_hit: true;
}

export class RagSemanticCacheLayer {
  private readonly cache: SemanticCache;
  private readonly vectorizer: TfIdfVectorizer;
  private readonly corpus: string[][] = [];

  constructor(options?: SemanticCacheOptions) {
    this.cache = new SemanticCache(options);
    this.vectorizer = new TfIdfVectorizer();
  }

  /**
   * Store a query result in the semantic cache.
   * Builds TF-IDF embedding for the query and stores it.
   */
  store(query: string, result: unknown): void {
    // Add query tokens to corpus and re-fit vectorizer
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    this.corpus.push(tokens);
    this.vectorizer.fit(this.corpus);

    const embedding = this.vectorizer.embed(query);
    this.cache.set(query, embedding, result);

    logger.debug("rag-semantic-cache:store", { query: query.slice(0, 50) });
  }

  /**
   * Look up a query in the cache.
   * First tries exact match, then falls back to similar match.
   * Returns null on cache miss.
   */
  lookup(query: string): CacheHitResult | null {
    // Try exact match first
    const exact = this.cache.getExact(query);
    if (exact !== undefined) {
      logger.debug("rag-semantic-cache:exact_hit", { query: query.slice(0, 50) });
      return { result: exact, type: "exact", _cache_hit: true };
    }

    // Try similar match via cosine similarity
    const embedding = this.vectorizer.embed(query);
    const similar = this.cache.getSimilar(embedding);
    if (similar !== undefined) {
      logger.debug("rag-semantic-cache:similar_hit", { query: query.slice(0, 50) });
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
}
