import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { buildTaskContext } from "../../core/context/compact-context.js";
import { SessionTracker } from "../../core/context/session-tracker.js";
import { applySessionDelta } from "../../core/context/context-session.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

/** Lazily instantiated SessionTracker (shared across calls). */
let sessionTracker: SessionTracker | null = null;

function getSessionTracker(store: SqliteStore): SessionTracker {
  if (!sessionTracker) {
    sessionTracker = new SessionTracker(store.getDb());
  }
  return sessionTracker;
}

export function registerContext(server: McpServer, store: SqliteStore): void {
  server.tool(
    "context",
    "Get a compact, AI-optimized context payload for a specific task (includes parent, children, blockers, dependencies, acceptance criteria, source references, and token reduction metrics). Pass sessionId to enable delta tracking — subsequent calls return only new/changed sections.",
    {
      id: z.string().min(1).describe("The node ID to build context for"),
      sessionId: z.string().min(1).optional().describe("Session ID for delta tracking — omit for full context every time"),
    },
    async ({ id, sessionId }) => {
      logger.debug("tool:context", { id, sessionId });
      const ctx = buildTaskContext(store, id);

      if (!ctx) {
        const err = new NodeNotFoundError(id);
        logger.warn("tool:context:fail", { error: err.message });
        return mcpError(err);
      }

      // Bug #035: add 'node' alias for semantic clarity (backward-compatible)
      ctx.node = ctx.task;

      // Session delta tracking — opt-in via sessionId
      if (sessionId) {
        const tracker = getSessionTracker(store);
        const result = applySessionDelta(tracker, sessionId, ctx);
        logger.info("tool:context:ok", { id, sessionId, savings: result._session_savings });
        return mcpText({ ...result.context, _session_savings: result._session_savings });
      }

      logger.info("tool:context:ok", { id });
      return mcpText(ctx);
    },
  );
}
