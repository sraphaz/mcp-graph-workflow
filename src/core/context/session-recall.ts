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
 * Session Recall Store — persists session summaries with FTS5 full-text search.
 * Enables cross-session recall via topic-based queries.
 * Inspired by hermes-agent cross-session recall with FTS5 + LLM summarization.
 */

import type Database from "better-sqlite3";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "session-recall.ts" });

export interface SessionSummary {
  id: string;
  sessionId: string;
  parentSessionId: string | null;
  summary: string;
  topics: string[];
  nodeIds: string[];
  tokensUsed: number;
  costUsd: number;
  createdAt: string;
}

export interface SaveSessionInput {
  sessionId: string;
  parentSessionId?: string;
  summary: string;
  topics: string[];
  nodeIds?: string[];
  tokensUsed?: number;
  costUsd?: number;
}

interface SessionRow {
  id: string;
  session_id: string;
  parent_session_id: string | null;
  summary: string;
  topics: string;
  node_ids: string;
  tokens_used: number;
  cost_usd: number;
  created_at: string;
}

function rowToSummary(row: SessionRow): SessionSummary {
  return {
    id: row.id,
    sessionId: row.session_id,
    parentSessionId: row.parent_session_id,
    summary: row.summary,
    topics: JSON.parse(row.topics) as string[],
    nodeIds: JSON.parse(row.node_ids) as string[],
    tokensUsed: row.tokens_used,
    costUsd: row.cost_usd,
    createdAt: row.created_at,
  };
}

export class SessionRecallStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  saveSessionSummary(input: SaveSessionInput): string {
    const id = generateId("sess_sum");
    const topicsJson = JSON.stringify(input.topics);
    const nodeIdsJson = JSON.stringify(input.nodeIds ?? []);
    const createdAt = now();

    // Upsert — update if session_id already exists
    this.db.prepare(
      `INSERT INTO session_summaries (id, session_id, parent_session_id, summary, topics, node_ids, tokens_used, cost_usd, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         summary = excluded.summary,
         topics = excluded.topics,
         node_ids = excluded.node_ids,
         tokens_used = excluded.tokens_used,
         cost_usd = excluded.cost_usd`,
    ).run(
      id,
      input.sessionId,
      input.parentSessionId ?? null,
      input.summary,
      topicsJson,
      nodeIdsJson,
      input.tokensUsed ?? 0,
      input.costUsd ?? 0,
      createdAt,
    );

    // Rebuild FTS5 index entry for this session
    try {
      const row = this.db.prepare(
        "SELECT rowid, summary, topics FROM session_summaries WHERE session_id = ?",
      ).get(input.sessionId) as { rowid: number; summary: string; topics: string } | undefined;

      if (row) {
        // Remove old FTS entry if any (safe to call even if not indexed)
        try {
          this.db.prepare(
            "INSERT INTO session_summaries_fts(session_summaries_fts, rowid, summary, topics) VALUES('delete', ?, ?, ?)",
          ).run(row.rowid, row.summary, row.topics);
        } catch (e) {
          log.debug("intentional swallow", { error: e, reason: "FTS session_summaries index may not exist yet" });
        }

        // Insert current data into FTS
        this.db.prepare(
          "INSERT INTO session_summaries_fts(rowid, summary, topics) VALUES(?, ?, ?)",
        ).run(row.rowid, input.summary, topicsJson);
      }
    } catch (err) {
      log.debug("session-recall:fts_index_failed", { error: String(err) });
    }

    log.debug("session-recall:saved", { sessionId: input.sessionId, topics: input.topics });
    return id;
  }

  recallSessions(query: string, limit: number = 10): SessionSummary[] {
    if (!query.trim()) return [];

    try {
      const rows = this.db.prepare(
        `SELECT s.* FROM session_summaries s
         JOIN session_summaries_fts f ON s.rowid = f.rowid
         WHERE session_summaries_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      ).all(query, limit) as SessionRow[];

      return rows.map(rowToSummary);
    } catch {
      // FTS5 query may fail with complex input — fall back to LIKE
      log.debug("session-recall:fts_fallback", { query });
      const rows = this.db.prepare(
        `SELECT * FROM session_summaries
         WHERE summary LIKE ? OR topics LIKE ?
         ORDER BY created_at DESC
         LIMIT ?`,
      ).all(`%${query}%`, `%${query}%`, limit) as SessionRow[];

      return rows.map(rowToSummary);
    }
  }

  getSessionChain(sessionId: string): SessionSummary[] {
    const chain: SessionSummary[] = [];
    let currentId: string | null = sessionId;

    // Walk up the chain to find the root
    const parents: string[] = [];
    while (currentId) {
      parents.unshift(currentId);
      const row = this.db.prepare(
        "SELECT parent_session_id FROM session_summaries WHERE session_id = ?",
      ).get(currentId) as { parent_session_id: string | null } | undefined;

      if (!row) break;
      currentId = row.parent_session_id;
    }

    // Fetch all summaries in order
    for (const sid of parents) {
      const row = this.db.prepare(
        "SELECT * FROM session_summaries WHERE session_id = ?",
      ).get(sid) as SessionRow | undefined;

      if (row) chain.push(rowToSummary(row));
    }

    return chain;
  }

  getBySessionId(sessionId: string): SessionSummary | null {
    const row = this.db.prepare(
      "SELECT * FROM session_summaries WHERE session_id = ?",
    ).get(sessionId) as SessionRow | undefined;

    return row ? rowToSummary(row) : null;
  }
}
