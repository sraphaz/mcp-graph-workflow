import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { startTask } from "../../core/pipeline/start-task.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerStartTask(server: McpServer, store: SqliteStore): void {
  server.tool(
    "start_task",
    "Pipeline: find next task + load context + RAG + TDD hints + mark in_progress — all in 1 call. Replaces: next → context → rag_context → update_status(in_progress).",
    {
      nodeId: z.string().optional().describe("Specific task ID (or auto via next)"),
      contextDetail: z.enum(["summary", "standard", "deep"]).optional().describe("RAG detail tier (default: standard)"),
      ragBudget: z.number().min(500).max(32000).optional().describe("Token budget for RAG context (default: 4000)"),
      autoStart: z.boolean().optional().describe("Auto-mark task in_progress (default: true)"),
    },
    async ({ nodeId, contextDetail, ragBudget, autoStart }) => {
      logger.debug("tool:start_task", { nodeId, contextDetail, ragBudget, autoStart });

      const result = startTask(store, { nodeId, contextDetail, ragBudget, autoStart });

      if (!result) {
        logger.info("tool:start_task:no_tasks");
        return mcpText({
          message: "No actionable tasks found. All tasks are either done or blocked.",
        });
      }

      logger.info("tool:start_task:ok", {
        nodeId: result.task.task.node.id,
        title: result.task.task.node.title,
        autoStart: result.startedAt !== null,
        tddHints: result.tddHints.length,
      });

      return mcpText({
        node: result.task.task.node,
        reason: result.task.task.reason,
        knowledgeCoverage: result.task.knowledgeCoverage,
        velocityContext: result.task.velocityContext,
        enhancedReason: result.task.enhancedReason,
        tddHints: result.tddHints,
        context: result.context,
        ragContext: result.ragContext,
        startedAt: result.startedAt,
      });
    },
  );
}
