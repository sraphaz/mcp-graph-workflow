import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { pruneKnowledge } from "../../core/rag/knowledge-pruner.js";
import { findDuplicates, findContradictions } from "../../core/rag/knowledge-dedup.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerKnowledgePrune(server: McpServer, store: SqliteStore): void {
  server.tool(
    "knowledge_prune",
    "Prune stale, low-quality, or duplicate knowledge documents. Strategies: 'age' (remove old), 'quality' (remove low-quality), 'dedup' (find and remove duplicates), 'budget' (enforce max document count). Use dryRun:true to preview without deleting.",
    {
      strategy: z
        .enum(["age", "quality", "dedup", "budget"])
        .describe("Pruning strategy: age, quality, dedup (remove duplicates), or budget (enforce max docs)"),
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
      maxDocs: z
        .number()
        .int()
        .min(10)
        .optional()
        .describe("Max documents to keep for 'budget' strategy (default: 100)"),
      dryRun: z
        .boolean()
        .optional()
        .describe("Preview without deleting (default: true)"),
    },
    async ({ strategy, maxAgeDays, minQuality, maxDocs, dryRun }) => {
      const db = store.getDb();
      const isDryRun = dryRun ?? true;

      logger.debug("tool:knowledge_prune", { strategy, dryRun: isDryRun });

      if (strategy === "budget") {
        const ks = new KnowledgeStore(db);
        const budgetLimit = maxDocs ?? 100;
        const result = ks.autoprune(budgetLimit, isDryRun);
        logger.info("tool:knowledge_prune:budget", { pruned: result.removed, budget: budgetLimit, dryRun: isDryRun });
        return mcpText({ strategy: "budget", pruned: result.removed, prunedIds: result.removedIds, dryRun: isDryRun, budget: budgetLimit, remaining: ks.count() });
      }

      if (strategy === "dedup") {
        const duplicates = findDuplicates(db);
        const contradictions = findContradictions(db);

        // Dedup now deletes older docs in each pair (unless dryRun)
        const result = pruneKnowledge(db, { strategy: "dedup", dryRun: isDryRun });

        logger.info("tool:knowledge_prune:dedup", {
          duplicates: duplicates.length,
          contradictions: contradictions.length,
          deleted: result.pruned,
          dryRun: isDryRun,
        });

        return mcpText({
          strategy: "dedup",
          pruned: result.pruned,
          prunedIds: result.prunedIds,
          dryRun: isDryRun,
          duplicates: isDryRun ? duplicates : undefined,
          contradictions,
          summary: {
            duplicatePairs: duplicates.length,
            contradictionPairs: contradictions.length,
            deleted: result.pruned,
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
