/**
 * Session Context Tracker — tracks chunks already sent to avoid re-sending.
 * Uses in-memory Map as L1 cache + SQLite (session_chunks table) for persistence.
 */

import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { estimateTokens } from "./token-estimator.js";
import { logger } from "../utils/logger.js";

export interface DeltaResult {
  newChunks: string[];
  skippedCount: number;
  tokensSaved: number;
}

export interface SessionStats {
  sentCount: number;
  totalTokens: number;
}

function md5(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

export class SessionTracker {
  private readonly db: Database.Database;
  /** L1 cache: sessionId → Set<contentHash> */
  private readonly cache: Map<string, Set<string>> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
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
    logger.debug("session-tracker:trackSent", { sessionId, chunksCount: chunks.length });
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
    logger.debug("session-tracker:clearSession", { sessionId });
  }

  /**
   * Get or load the in-memory cache for a session.
   * On first access, loads existing hashes from SQLite.
   */
  private getOrLoadCache(sessionId: string): Set<string> {
    let cached = this.cache.get(sessionId);
    if (cached) {
      return cached;
    }

    // Load from SQLite
    const rows = this.db
      .prepare("SELECT content_hash FROM session_chunks WHERE session_id = ?")
      .all(sessionId) as Array<{ content_hash: string }>;

    cached = new Set(rows.map((r) => r.content_hash));
    this.cache.set(sessionId, cached);
    return cached;
  }
}
