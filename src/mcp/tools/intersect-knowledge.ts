/**
 * MCP Tool — intersect_knowledge
 * Discover cross-domain knowledge intersections and generate novel skill ideas.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  computeIntersections,
  generateIntersectionInsights,
  listIntersections,
  getIntersectionDetail,
} from "../../core/insights/interdisciplinary-intersector.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerIntersectKnowledge(server: McpServer, store: SqliteStore): void {
  server.tool(
    "intersect_knowledge",
    "Discover cross-domain knowledge intersections and generate novel skill ideas from the knowledge store.",
    {
      action: z
        .enum(["discover", "list", "detail"])
        .describe("Action: discover (run intersection analysis), list (show previous), detail (single insight)"),
      concept: z
        .string()
        .optional()
        .describe("Filter intersections by concept keyword (e.g. 'quantum', 'blockchain')"),
      minScore: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Minimum combined score threshold (default 0.15)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Maximum results to return (default 10)"),
      docId: z
        .string()
        .optional()
        .describe("Document ID for detail action"),
    },
    async ({ action, concept, minScore, limit, docId }) => {
      logger.debug("tool:intersect_knowledge", { action, concept, minScore, limit, docId });

      const project = store.getProject();
      if (!project) {
        return mcpError("No active project. Run init first.");
      }

      switch (action) {
        case "discover": {
          const candidates = computeIntersections(store.getDb(), { concept, minScore, limit });

          if (candidates.length === 0) {
            return mcpText({
              ok: true,
              message: "No cross-domain intersections found above threshold. Try lowering minScore or adding more diverse knowledge.",
              intersections: [],
            });
          }

          const insights = generateIntersectionInsights(store.getDb(), candidates);

          return mcpText({
            ok: true,
            message: `Discovered ${insights.length} cross-domain intersection(s).`,
            intersections: insights.map((i) => ({
              id: i.id,
              domains: i.domains,
              score: i.score,
              sharedConcepts: i.sharedConcepts,
              suggestedSkillName: i.suggestedSkillName,
              suggestedSkillDescription: i.suggestedSkillDescription,
              sourceDocCount: i.sourceDocCount,
            })),
          });
        }

        case "list": {
          const docs = listIntersections(store.getDb(), limit ?? 20);

          return mcpText({
            ok: true,
            count: docs.length,
            intersections: docs.map((d) => ({
              id: d.id,
              title: d.title,
              sourceId: d.sourceId,
              metadata: d.metadata,
              createdAt: d.createdAt,
            })),
          });
        }

        case "detail": {
          if (!docId) {
            return mcpError("docId is required for detail action.");
          }

          const doc = getIntersectionDetail(store.getDb(), docId);
          if (!doc) {
            return mcpError(`Intersection insight not found: ${docId}`);
          }

          return mcpText({
            ok: true,
            id: doc.id,
            title: doc.title,
            sourceId: doc.sourceId,
            content: doc.content,
            metadata: doc.metadata,
            createdAt: doc.createdAt,
          });
        }

        default:
          return mcpError(`Unknown action: ${action as string}`);
      }
    },
  );
}
