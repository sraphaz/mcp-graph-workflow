/**
 * In-memory semantic cache for RAG query results.
 * Supports exact match (MD5 hash) and similar match (cosine similarity).
 * TTL-based expiration and LRU-style eviction.
 */

import { createHash } from "node:crypto";

export interface SemanticCacheOptions {
  ttlMs?: number;
  maxEntries?: number;
}

interface CacheEntry {
  queryHash: string;
  query: string;
  embedding: number[];
  result: unknown;
  createdAt: number;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

function md5(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export class SemanticCache {
  private readonly entries: Map<string, CacheEntry> = new Map();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(options?: SemanticCacheOptions) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  /**
   * Store a query result with its embedding.
   */
  set(query: string, embedding: number[], result: unknown): void {
    const queryHash = md5(query);
    const now = Date.now();

    // If same query exists, remove it first (will be re-added at end of Map)
    this.entries.delete(queryHash);

    // Evict oldest if at capacity
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(queryHash, {
      queryHash,
      query,
      embedding,
      result,
      createdAt: now,
      expiresAt: now + this.ttlMs,
    });
  }

  /**
   * Exact match lookup via MD5 hash of the query string.
   */
  getExact(query: string): unknown | undefined {
    const queryHash = md5(query);
    const entry = this.entries.get(queryHash);

    if (!entry) {
      this.missCount++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(queryHash);
      this.missCount++;
      return undefined;
    }

    this.hitCount++;
    return entry.result;
  }

  /**
   * Similar match via cosine similarity on embeddings.
   * Returns the result of the most similar entry above threshold.
   */
  getSimilar(
    queryEmbedding: number[],
    threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
  ): unknown | undefined {
    const now = Date.now();
    let bestResult: unknown | undefined;
    let bestSimilarity = -1;

    for (const [key, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
        continue;
      }

      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= threshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestResult = entry.result;
      }
    }

    if (bestResult !== undefined) {
      this.hitCount++;
    } else {
      this.missCount++;
    }

    return bestResult;
  }

  /**
   * Return cache statistics.
   */
  stats(): { hits: number; misses: number; size: number } {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      size: this.entries.size,
    };
  }
}
