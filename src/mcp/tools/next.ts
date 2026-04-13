import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { LockManager } from "../../core/store/lock-manager.js";
import { findEnhancedNextTask } from "../../core/planner/enhanced-next.js";
import { generateTddHints, generateTddHintsFromTexts } from "../../core/implementer/tdd-checker.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerNext(server: McpServer, store: SqliteStore, lockManager?: LockManager): void {
  server.tool(
    "next",
    "Suggest the next best task to work on based on priority, dependencies, size, knowledge coverage, and velocity. Includes TDD hints from acceptance criteria. In teamTask mode, excludes tasks locked by other agents.",
    {
      agentId: z.string().optional().describe("Agent ID for teamTask mode — excludes tasks locked by other agents"),
    },
    async ({ agentId }) => {
      logger.debug("tool:next", { agentId });
      const doc = store.toGraphDocument();
      const result = findEnhancedNextTask(doc, store, { lockManager, agentId });

      if (!result) {
        logger.info("tool:next:ok", { found: false });
        return mcpText({
          message: "No actionable tasks found. All tasks are either done or blocked.",
        });
      }

      // Collect AC from both inline and child nodes
      const acChildNodes = doc.nodes.filter(
        (n) => n.type === "acceptance_criteria" && n.parentId === result.task.node.id,
      );
      const acTexts = [
        ...(result.task.node.acceptanceCriteria ?? []),
        ...acChildNodes.map((n) => n.title),
      ];
      const tddHints = acTexts.length > 0
        ? generateTddHintsFromTexts(acTexts)
        : generateTddHints(result.task.node);

      logger.info("tool:next:ok", {
        found: true,
        nodeId: result.task.node.id,
        knowledgeCoverage: result.knowledgeCoverage,
        tddHints: tddHints.length,
      });

      return mcpText({
        node: result.task.node,
        reason: result.task.reason,
        knowledgeCoverage: result.knowledgeCoverage,
        velocityContext: result.velocityContext,
        enhancedReason: result.enhancedReason,
        tddHints,
      });
    },
  );
}
