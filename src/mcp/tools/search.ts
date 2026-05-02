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

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { searchNodes } from "../../core/search/fts-search.js";
import { SessionRecallStore } from "../../core/context/session-recall.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

/** registerSearch — auto-generated description placeholder. */
export function registerSearch(server: McpServer, store: SqliteStore): void {
  server.tool(
    "search",
    "Full-text search across graph nodes using BM25 ranking. Searches title, description and tags. Use scope='sessions' to search across past session summaries.",
    {
      query: z.string().min(1).describe("Search query text"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum results to return (default: 20)"),
      rerank: z
        .boolean()
        .optional()
        .describe("Apply TF-IDF reranking for better relevance (default: false)"),
      scope: z
        .enum(["nodes", "sessions"])
        .optional()
        .describe("Search scope: 'nodes' (default) for graph nodes, 'sessions' for past session summaries"),
    },
    async ({ query, limit, rerank, scope }) => {
      logger.debug("tool:search", { query, limit, scope });

      // Session scope: search across session summaries
      if (scope === "sessions") {
        try {
          const recallStore = new SessionRecallStore(store.getDb());
          const sessions = recallStore.recallSessions(query, limit ?? 20);
          logger.info("tool:search:sessions:ok", { query, total: sessions.length });
          return mcpText({
            query,
            scope: "sessions",
            total: sessions.length,
            results: sessions.map((s) => ({
              sessionId: s.sessionId,
              summary: s.summary,
              topics: s.topics,
              parentSessionId: s.parentSessionId,
              createdAt: s.createdAt,
            })),
          });
        } catch (err) {
          logger.warn("tool:search:sessions:error", { error: err instanceof Error ? err.message : String(err) });
          return mcpText({ query, scope: "sessions", total: 0, results: [], hint: "Session recall table may not exist yet. Run a task cycle first." });
        }
      }

      // Bug #063: detect wildcard-only queries that produce empty FTS results
      if (/^[*?]+$/.test(query.trim())) {
        return mcpText({
          query,
          total: 0,
          hasMore: false,
          results: [],
          hint: "Wildcard-only queries not supported by FTS. Use list() to see all nodes.",
        });
      }

      const results = searchNodes(store, query, { limit: limit ?? 20, rerank: rerank ?? false });

      const items = results.map((r) => ({
        id: r.node.id,
        type: r.node.type,
        title: r.node.title,
        status: r.node.status,
        priority: r.node.priority,
        score: Math.round(r.score * 1000) / 1000,
        // Bug #064: fallback to title when description is null
        snippet: r.node.description?.slice(0, 200) ?? r.node.title,
      }));

      // Bug #024: indicate when results may be truncated by limit
      const effectiveLimit = limit ?? 20;
      const hasMore = items.length >= effectiveLimit;
      logger.info("tool:search:ok", { query, total: items.length, hasMore });
      return mcpText({ query, total: items.length, hasMore, results: items });
    },
  );
}
