import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { pruneKnowledge } from "../../core/rag/knowledge-pruner.js";
import { findDuplicates, findContradictions } from "../../core/rag/knowledge-dedup.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerKnowledgePrune(server: McpServer, store: SqliteStore): void {
  server.tool(
    "knowledge_prune",
    "Prune stale, low-quality, or duplicate knowledge documents. Strategies: 'age' (remove old), 'quality' (remove low-quality), 'dedup' (report duplicates and contradictions). Use dryRun:true to preview without deleting.",
    {
      strategy: z
        .enum(["age", "quality", "dedup"])
        .describe("Pruning strategy: age, quality, or dedup (report only)"),
      maxAgeDays: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Max age in days for 'age' strategy (default: 90)"),
      minQuality: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Min quality score for 'quality' strategy (default: 0.3)"),
      dryRun: z
        .boolean()
        .optional()
        .describe("Preview without deleting (default: true)"),
    },
    async ({ strategy, maxAgeDays, minQuality, dryRun }) => {
      const db = store.getDb();
      const isDryRun = dryRun ?? true;

      logger.debug("tool:knowledge_prune", { strategy, dryRun: isDryRun });

      if (strategy === "dedup") {
        const duplicates = findDuplicates(db);
        const contradictions = findContradictions(db);

        logger.info("tool:knowledge_prune:dedup", {
          duplicates: duplicates.length,
          contradictions: contradictions.length,
        });

        return mcpText({
          strategy: "dedup",
          duplicates,
          contradictions,
          summary: {
            duplicatePairs: duplicates.length,
            contradictionPairs: contradictions.length,
          },
        });
      }

      const result = pruneKnowledge(db, {
        strategy,
        maxAgeDays,
        minQuality,
        dryRun: isDryRun,
      });

      logger.info("tool:knowledge_prune:ok", {
        strategy,
        pruned: result.pruned,
        dryRun: isDryRun,
      });

      return mcpText(result);
    },
  );
}
