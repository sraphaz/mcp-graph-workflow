/**
 * Relevance Tracker — implicit feedback for RAG quality improvement.
 * Tracks query→document associations and detects requeries (same intent, different words)
 * to infer negative feedback when users aren't satisfied with results.
 */

import type Database from "better-sqlite3";
import { generateId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

const REQUERY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const TERM_OVERLAP_THRESHOLD = 0.5; // >50% overlap = requery
const BOOST_FACTOR = 0.2;

export interface RequeryResult {
  isRequery: boolean;
  previousDocIds: string[];
}

/**
 * Tokenize a query into lowercase words for overlap comparison.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

/**
 * Calculate term overlap ratio between two token sets.
 */
function termOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }

  const smaller = Math.min(a.size, b.size);
  return smaller > 0 ? intersection / smaller : 0;
}

export class RelevanceTracker {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Record positive implicit feedback for documents returned in a query.
   */
  trackQuery(sessionId: string, query: string, documentIds: string[]): void {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(
      "INSERT INTO relevance_feedback (id, session_id, query, document_id, signal, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );

    this.db.transaction(() => {
      for (const docId of documentIds) {
        stmt.run(generateId(), sessionId, query, docId, "positive", now);
      }
    })();

    logger.debug("relevance-tracker:trackQuery", { sessionId, query: query.slice(0, 50), docs: documentIds.length });
  }

  /**
   * Detect if a query is a requery (user rephrasing because results were unsatisfactory).
   * If detected, marks previous documents as negative feedback.
   */
  detectRequery(sessionId: string, query: string): RequeryResult {
    const cutoff = new Date(Date.now() - REQUERY_WINDOW_MS).toISOString();

    // Get recent positive feedback for this session within the time window
    const recentRows = this.db
      .prepare(
        "SELECT DISTINCT query, document_id FROM relevance_feedback WHERE session_id = ? AND signal = 'positive' AND created_at > ? ORDER BY created_at DESC",
      )
      .all(sessionId, cutoff) as Array<{ query: string; document_id: string }>;

    if (recentRows.length === 0) {
      return { isRequery: false, previousDocIds: [] };
    }

    // Group by query to find the most recent previous query
    const queryTokens = tokenize(query);
    const previousQueries = new Map<string, string[]>();

    for (const row of recentRows) {
      if (!previousQueries.has(row.query)) {
        previousQueries.set(row.query, []);
      }
      const docList = previousQueries.get(row.query);
      if (docList) docList.push(row.document_id);
    }

    // Check overlap with each previous query
    for (const [prevQuery, docIds] of previousQueries) {
      const prevTokens = tokenize(prevQuery);
      const overlap = termOverlap(queryTokens, prevTokens);

      if (overlap > TERM_OVERLAP_THRESHOLD) {
        // Mark previous docs as negative
        const now = new Date().toISOString();
        const stmt = this.db.prepare(
          "INSERT INTO relevance_feedback (id, session_id, query, document_id, signal, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        );

        this.db.transaction(() => {
          for (const docId of docIds) {
            stmt.run(generateId(), sessionId, query, docId, "negative", now);
          }
        })();

        logger.debug("relevance-tracker:requery", {
          sessionId,
          prevQuery: prevQuery.slice(0, 50),
          newQuery: query.slice(0, 50),
          overlap,
          negativeDocs: docIds.length,
        });

        return { isRequery: true, previousDocIds: docIds };
      }
    }

    return { isRequery: false, previousDocIds: [] };
  }

  /**
   * Get relevance boost for a list of document IDs.
   * boost = (positive - negative) / total * BOOST_FACTOR
   */
  getRelevanceBoost(documentIds: string[]): Map<string, number> {
    const boosts = new Map<string, number>();

    if (documentIds.length === 0) return boosts;

    const placeholders = documentIds.map(() => "?").join(",");
    const rows = this.db
      .prepare(
        `SELECT document_id, signal, COUNT(*) as cnt FROM relevance_feedback WHERE document_id IN (${placeholders}) GROUP BY document_id, signal`,
      )
      .all(...documentIds) as Array<{ document_id: string; signal: string; cnt: number }>;

    // Aggregate per doc
    const stats = new Map<string, { positive: number; negative: number }>();

    for (const row of rows) {
      if (!stats.has(row.document_id)) {
        stats.set(row.document_id, { positive: 0, negative: 0 });
      }
      const s = stats.get(row.document_id);
      if (!s) continue;
      if (row.signal === "positive") s.positive += row.cnt;
      else if (row.signal === "negative") s.negative += row.cnt;
    }

    for (const docId of documentIds) {
      const s = stats.get(docId);
      if (!s) {
        boosts.set(docId, 0);
        continue;
      }
      const total = s.positive + s.negative;
      const boost = total > 0 ? ((s.positive - s.negative) / total) * BOOST_FACTOR : 0;
      boosts.set(docId, boost);
    }

    return boosts;
  }
}
