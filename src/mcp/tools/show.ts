import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { LockManager } from "../../core/store/lock-manager.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerShow(server: McpServer, store: SqliteStore): void {
  server.tool(
    "show",
    "Show detailed information about a specific node, including its edges and children",
    {
      id: z.string().min(1).describe("The node ID to inspect"),
      includeHistory: z.boolean().optional().describe("Include node changelog (audit trail) in response"),
    },
    async ({ id, includeHistory }) => {
      logger.debug("tool:show", { id });
      const node = store.getNodeById(id);
      if (!node) {
        const err = new NodeNotFoundError(id);
        logger.warn("tool:show:fail", { error: err.message });
        return mcpError(err);
      }

      const edgesFrom = store.getEdgesFrom(id);
      const edgesTo = store.getEdgesTo(id);
      const children = store.getChildNodes(id);

      const result: Record<string, unknown> = {
        node,
        outgoingEdges: edgesFrom,
        incomingEdges: edgesTo,
        children: children.map((c) => ({
          id: c.id,
          type: c.type,
          title: c.title,
          status: c.status,
        })),
      };

      if (includeHistory) {
        result.changelog = store.getNodeHistory(id);
      }

      // Add lock info when teamTask mode is on
      const teamTaskMode = store.getProjectSetting("team_task_mode") === "on";
      if (teamTaskMode) {
        try {
          const lm = new LockManager(store.getDb());
          const lockInfo = lm.listActive().find((l) => l.resourceId === `task:${id}`);
          if (lockInfo) {
            const ttlMs = new Date(lockInfo.expiresAt).getTime() - Date.now();
            result.lock = {
              agentId: lockInfo.agentId,
              expiresAt: lockInfo.expiresAt,
              ttlRemainingMs: Math.max(0, ttlMs),
              leaseToken: lockInfo.leaseToken,
            };
          }
        } catch { /* non-blocking */ }
      }

      logger.info("tool:show:ok", { id, edgesOut: edgesFrom.length, edgesIn: edgesTo.length, children: children.length, includeHistory: !!includeHistory });
      return mcpText(result);
    },
  );
}
