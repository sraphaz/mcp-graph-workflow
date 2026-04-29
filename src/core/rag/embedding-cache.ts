/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-17.T03 — Generic embedding cache for hybrid retrieval pipeline.
 *
 * Provider-agnostic: works for ONNX (384-dim float arrays) and TF-IDF
 * (sparse-but-flat float arrays) alike. Key = sha256(text) so identical
 * text deduplicates regardless of caller, and arbitrary-length text never
 * blows up the cache key dimension.
 *
 * Why not reuse tfidf-embedding-cache.ts: that one is keyed on raw query
 * string and tightly coupled to the TF-IDF tokenizer cycle. This module
 * is a thin LRU layer that any embedder can wrap.
 */

import { LRUCache } from "lru-cache";
import { createHash } from "node:crypto";

export interface EmbeddingCacheOptions {
  /** Maximum number of cached vectors. Default 10000 per §EPIC-17.T03. */
  maxSize?: number;
}

export function hashTextKey(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const DEFAULT_MAX_SIZE = 10_000;

export interface EmbeddingCacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  /** hits / (hits + misses); 0 when no lookups have happened yet. */
  hitRate: number;
}

export class EmbeddingCache {
  readonly maxSize: number;
  private readonly lru: LRUCache<string, number[]>;
  private hits = 0;
  private misses = 0;

  constructor(options: EmbeddingCacheOptions = {}) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.lru = new LRUCache<string, number[]>({ max: this.maxSize });
  }

  get(text: string): number[] | undefined {
    const v = this.lru.get(hashTextKey(text));
    if (v === undefined) this.misses++;
    else this.hits++;
    return v;
  }

  set(text: string, vector: number[]): void {
    this.lru.set(hashTextKey(text), vector);
  }

  size(): number {
    return this.lru.size;
  }

  clear(): void {
    this.lru.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): EmbeddingCacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.lru.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }
}
