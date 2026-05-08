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
 * Session Context Tracker — tracks chunks already sent to avoid re-sending.
 * Uses in-memory Map as L1 cache + SQLite (session_chunks table) for persistence.
 *
 * L1 cache is bounded (LRU + TTL) to prevent unbounded memory growth when many
 * concurrent agents create distinct sessionIds. SQLite is the source of truth —
 * evicting an L1 entry only forces a reload on the next access.
 */

import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { estimateTokens } from "./token-estimator.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "session-tracker.ts" });

export interface DeltaResult {
  newChunks: string[];
  skippedCount: number;
  tokensSaved: number;
}

export interface SessionStats {
  sentCount: number;
  totalTokens: number;
}

export interface SessionTrackerOptions {
  /** Max sessions kept in L1 cache before LRU eviction. Default: 50. */
  maxSessions?: number;
  /** Time-to-live in ms for L1 cache entries. Default: 30min. */
  ttlMs?: number;
}

interface CacheEntry {
  hashes: Set<string>;
  lastAccess: number;
}

const DEFAULT_MAX_SESSIONS = 50;
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function md5(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

export class SessionTracker {
  private readonly db: Database.Database;
  private readonly maxSessions: number;
  private readonly ttlMs: number;
  /** L1 cache: sessionId → { hashes, lastAccess }. Iteration order = insertion order. */
  private readonly cache: Map<string, CacheEntry> = new Map();

  constructor(db: Database.Database, options: SessionTrackerOptions = {}) {
    this.db = db;
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  /**
   * Register chunks as sent for a session.
   * Stores MD5 hashes in SQLite + in-memory cache.
   */
  trackSent(sessionId: string, chunks: string[]): void {
    const cached = this.getOrLoadCache(sessionId);
    const now = new Date().toISOString();

    const insertStmt = this.db.prepare(
      "INSERT OR IGNORE INTO session_chunks (session_id, content_hash, tokens, tracked_at) VALUES (?, ?, ?, ?)",
    );

    const insertAll = this.db.transaction(() => {
      for (const chunk of chunks) {
        const hash = md5(chunk);
        if (!cached.has(hash)) {
          const tokens = estimateTokens(chunk);
          insertStmt.run(sessionId, hash, tokens, now);
          cached.add(hash);
        }
      }
    });

    insertAll();
    log.debug("session-tracker:trackSent", { sessionId, chunksCount: chunks.length });
  }

  /**
   * Get delta between provided chunks and already-sent chunks.
   * Returns only new (unseen) chunks.
   */
  getDelta(sessionId: string, chunks: string[]): DeltaResult {
    const cached = this.getOrLoadCache(sessionId);

    const newChunks: string[] = [];
    let skippedCount = 0;
    let tokensSaved = 0;

    for (const chunk of chunks) {
      const hash = md5(chunk);
      if (cached.has(hash)) {
        skippedCount++;
        tokensSaved += estimateTokens(chunk);
      } else {
        newChunks.push(chunk);
      }
    }

    return { newChunks, skippedCount, tokensSaved };
  }

  /**
   * Get statistics for a session.
   */
  getSessionStats(sessionId: string): SessionStats {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as cnt, COALESCE(SUM(tokens), 0) as total FROM session_chunks WHERE session_id = ?",
      )
      .get(sessionId) as { cnt: number; total: number };

    return { sentCount: row.cnt, totalTokens: row.total };
  }

  /**
   * Clear all data for a session from SQLite and in-memory cache.
   */
  clearSession(sessionId: string): void {
    this.db
      .prepare("DELETE FROM session_chunks WHERE session_id = ?")
      .run(sessionId);
    this.cache.delete(sessionId);
    log.debug("session-tracker:clearSession", { sessionId });
  }

  /** Current L1 cache size (for observability / tests). */
  cacheSize(): number {
    return this.cache.size;
  }

  /**
   * Evict L1 entries whose lastAccess is older than ttlMs. Returns evicted count.
   * Safe to call on a timer; does not touch SQLite.
   */
  cleanupStale(): number {
    const cutoff = Date.now() - this.ttlMs;
    let evicted = 0;
    for (const [sessionId, entry] of this.cache) {
      if (entry.lastAccess < cutoff) {
        this.cache.delete(sessionId);
        evicted++;
      }
    }
    if (evicted > 0) {
      log.debug("session-tracker:cleanupStale", { evicted, remaining: this.cache.size });
    }
    return evicted;
  }

  /**
   * Delete session_chunks rows whose `tracked_at` is older than the given age.
   * Defaults to the tracker's configured ttlMs. Returns the number of rows
   * removed. Pair with `cleanupStale()` in a periodic timer to keep both the
   * L1 cache and SQLite footprint bounded.
   */
  cleanupStaleDb(maxAgeMs?: number): number {
    const ttl = maxAgeMs ?? this.ttlMs;
    const cutoffIso = new Date(Date.now() - ttl).toISOString();
    const resultValue = this.db
      .prepare("DELETE FROM session_chunks WHERE tracked_at < ?")
      .run(cutoffIso);
    if (resultValue.changes > 0) {
      log.debug("session-tracker:cleanupStaleDb", {
        cutoffIso,
        rowsDeleted: resultValue.changes,
      });
    }
    return resultValue.changes;
  }

  /**
   * Get or load the in-memory cache for a session.
   * On first access, loads existing hashes from SQLite. Touches LRU order on every access
   * and evicts the least-recently-used entry if size exceeds maxSessions.
   */
  private getOrLoadCache(sessionId: string): Set<string> {
    const existing = this.cache.get(sessionId);
    if (existing) {
      existing.lastAccess = Date.now();
      // Re-insert to move to end of iteration order (Map preserves insertion order).
      this.cache.delete(sessionId);
      this.cache.set(sessionId, existing);
      return existing.hashes;
    }

    const rows = this.db
      .prepare("SELECT content_hash FROM session_chunks WHERE session_id = ?")
      .all(sessionId) as Array<{ content_hash: string }>;

    const entry: CacheEntry = {
      hashes: new Set(rows.map((r) => r.content_hash)),
      lastAccess: Date.now(),
    };
    this.cache.set(sessionId, entry);

    if (this.cache.size > this.maxSessions) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined && oldestKey !== sessionId) {
        this.cache.delete(oldestKey);
        log.debug("session-tracker:evict", { sessionId: oldestKey });
      }
    }

    return entry.hashes;
  }
}
