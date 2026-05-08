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
 * ResponseCache — generic in-memory cache for any response type.
 *
 * Used to cache RAG context responses (detail, default paths)
 * that return different object shapes than RankedResult[].
 *
 * Features:
 * - TTL-based expiration
 * - True LRU eviction (by lastAccessedAt)
 * - Key normalization (case-insensitive, trimmed)
 * - Hit/miss statistics
 * - Bulk invalidation
 */

import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "rag", source: "response-cache.ts" });

export interface ResponseCacheOptions {
  ttlMs: number;
  maxSize: number;
}

interface CacheEntry {
  data: unknown;
  createdAt: number;
  lastAccessedAt: number;
}

export interface ResponseCacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export class ResponseCache {
  private entries: Map<string, CacheEntry> = new Map();
  private ttlMs: number;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(options: ResponseCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxSize = options.maxSize;
  }

  get(key: string): unknown | undefined {
    const normalized = normalizeKey(key);
    const entry = this.entries.get(normalized);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.entries.delete(normalized);
      this.misses++;
      return undefined;
    }

    // E5-T08: Move to end of Map for O(1) LRU eviction (delete + re-insert)
    entry.lastAccessedAt = Date.now();
    this.entries.delete(normalized);
    this.entries.set(normalized, entry);
    this.hits++;
    return entry.data;
  }

  set(key: string, data: unknown): void {
    const normalized = normalizeKey(key);

    if (this.entries.size >= this.maxSize && !this.entries.has(normalized)) {
      this.evictLru();
    }

    this.entries.set(normalized, {
      data,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    });
  }

  invalidateAll(): void {
    const count = this.entries.size;
    this.entries.clear();
    log.debug("ResponseCache invalidated", { entriesCleared: count });
  }

  getStats(): ResponseCacheStats {
    return {
      size: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }

  // E5-T08: O(1) LRU eviction via Map insertion order
  // Map.keys().next() returns the first (oldest) key since we
  // delete+re-insert on access to maintain LRU order.
  private evictLru(): void {
    const oldest = this.entries.keys().next();
    if (!oldest.done) {
      this.entries.delete(oldest.value);
      this.evictions++;
    }
  }
}
