/**
 * MCP Tool — delegate
 * Create and manage sub-agent delegations with restricted toolsets.
 * Enforces maxDepth=2, maxConcurrent=3 safety constraints.
 * Inspired by hermes-agent delegation tool.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { DelegationEngine, MAX_DEPTH, MAX_CONCURRENT } from "../../core/agents/delegation-engine.js";
import { DelegationTaskSchema } from "../../schemas/delegation.schema.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerDelegate(server: McpServer, store: SqliteStore): void {
  server.tool(
    "delegate",
    "Create and manage sub-agent delegations with restricted toolsets. Enforces maxDepth=2 and maxConcurrent=3 safety constraints.",
    {
      action: z
        .enum(["create", "complete", "fail", "get", "list_active"])
        .describe("Action to perform"),
      parentAgentId: z
        .string()
        .optional()
        .describe("Parent agent ID (required for create)"),
      delegationId: z
        .string()
        .optional()
        .describe("Delegation ID (required for complete/fail/get)"),
      depth: z
        .number()
        .int()
        .min(1)
        .max(MAX_DEPTH)
        .optional()
        .describe(`Delegation depth (1-${MAX_DEPTH}, default 1)`),
      task: z
        .object({
          objective: z.string().min(1).describe("What the child agent should accomplish"),
          allowedTools: z.array(z.string()).min(1).describe("Tools the child agent can use"),
          parentNodeId: z.string().optional().describe("Graph node this delegation relates to"),
          timeoutMs: z.number().int().positive().optional().describe("Timeout in ms (default 5 min)"),
        })
        .optional()
        .describe("Delegation task (required for create)"),
      summary: z
        .string()
        .optional()
        .describe("Result summary (required for complete)"),
      errorMessage: z
        .string()
        .optional()
        .describe("Error message (required for fail)"),
      tokensUsed: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Tokens used by the delegation (for complete)"),
    },
    async ({ action, parentAgentId, delegationId, depth, task, summary, errorMessage, tokensUsed }) => {
      logger.debug("tool:delegate", { action, parentAgentId, delegationId });

      const project = store.getProject();
      if (!project) {
        return mcpError("No active project. Run init first.");
      }

      const db = store.getDb();
      const engine = new DelegationEngine(db);

      try {
        switch (action) {
          case "create": {
            if (!parentAgentId) {
              return mcpError("parentAgentId required for create");
            }
            if (!task) {
              return mcpError("task required for create");
            }

            const parsed = DelegationTaskSchema.safeParse(task);
            if (!parsed.success) {
              return mcpError(`Validation failed: ${JSON.stringify(parsed.error.issues)}`);
            }

            const id = engine.create(parentAgentId, parsed.data, depth ?? 1);
            logger.info("tool:delegate:create:ok", { id, parentAgentId, depth: depth ?? 1 });

            return mcpText({
              ok: true,
              delegationId: id,
              parentAgentId,
              childObjective: parsed.data.objective,
              allowedTools: parsed.data.allowedTools,
              depth: depth ?? 1,
              constraints: {
                maxDepth: MAX_DEPTH,
                maxConcurrent: MAX_CONCURRENT,
              },
              hint: `Child agent should use only the allowed tools. Complete via delegate(action: 'complete', delegationId: '${id}').`,
            });
          }

          case "complete": {
            if (!delegationId) {
              return mcpError("delegationId required for complete");
            }
            if (!summary) {
              return mcpError("summary required for complete");
            }

            engine.complete(delegationId, summary, tokensUsed ?? 0);
            const record = engine.getById(delegationId);
            logger.info("tool:delegate:complete:ok", { delegationId, tokensUsed: tokensUsed ?? 0 });

            return mcpText({
              ok: true,
              delegationId,
              status: "completed",
              record,
            });
          }

          case "fail": {
            if (!delegationId) {
              return mcpError("delegationId required for fail");
            }
            if (!errorMessage) {
              return mcpError("errorMessage required for fail");
            }

            engine.fail(delegationId, errorMessage);
            logger.warn("tool:delegate:fail:ok", { delegationId, errorMessage });

            return mcpText({
              ok: true,
              delegationId,
              status: "failed",
              errorMessage,
            });
          }

          case "get": {
            if (!delegationId) {
              return mcpError("delegationId required for get");
            }

            const record = engine.getById(delegationId);
            if (!record) {
              return mcpError(`Delegation '${delegationId}' not found`);
            }

            return mcpText({ ok: true, delegation: record });
          }

          case "list_active": {
            const activeCount = engine.getActiveCount();
            let activeDelegations = undefined;

            if (parentAgentId) {
              activeDelegations = engine.getActiveForParent(parentAgentId);
            }

            return mcpText({
              ok: true,
              activeCount,
              maxConcurrent: MAX_CONCURRENT,
              ...(activeDelegations !== undefined ? { activeDelegations } : {}),
              hint: activeCount >= MAX_CONCURRENT
                ? "Max concurrent delegations reached. Complete or fail existing delegations first."
                : `${MAX_CONCURRENT - activeCount} delegation slot(s) available.`,
            });
          }

          default:
            return mcpError(`Unknown action: ${action as string}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("tool:delegate:error", { action, error: message });
        return mcpError(message);
      }
    },
  );
}
