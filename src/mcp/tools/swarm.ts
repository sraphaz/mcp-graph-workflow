/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type Database from "better-sqlite3";
import { SwarmCoordinator } from "../../core/swarm/swarm-coordinator.js";
import { TopologySchema, ConsensusKindSchema } from "../../core/swarm/swarm-types.js";
import { mcpText, mcpError, type McpToolResponse } from "../response-helpers.js";

export const swarmInputSchema = z.object({
  action: z.enum(["init", "start", "status", "scale", "stop"]).describe(
    "Swarm action — status is read-only; init/start/scale/stop are mutating.",
  ),
  // init params
  topology: TopologySchema.optional().describe("Swarm topology (init)"),
  consensus: ConsensusKindSchema.optional().describe("Consensus algorithm (init)"),
  maxAgents: z.number().int().min(1).max(32).optional().describe("Max agents ceiling (init/scale)"),
  strategy: z.string().optional().describe("Task strategy, default 'specialized' (init)"),
  // session-scoped params
  sessionId: z.string().optional().describe("Session id (start/status/scale/stop)"),
});

export type SwarmToolInput = z.infer<typeof swarmInputSchema>;

export function buildSwarmHandler(db: Database.Database): (input: SwarmToolInput) => Promise<McpToolResponse> {
  const coordinator = new SwarmCoordinator(db);

  return async (input) => {
    try {
      switch (input.action) {
        case "init": {
          const session = coordinator.init({
            topology: input.topology ?? "hierarchical",
            consensus: input.consensus ?? "raft",
            maxAgents: input.maxAgents ?? 4,
            strategy: input.strategy ?? "specialized",
          });
          return mcpText({ sessionId: session.id, status: session.status, topology: session.topology });
        }

        case "start": {
          if (!input.sessionId) return mcpError("sessionId required for start");
          const session = coordinator.start(input.sessionId);
          return mcpText({ sessionId: session.id, status: session.status });
        }

        case "status": {
          if (!input.sessionId) return mcpError("sessionId required for status");
          const session = coordinator.status(input.sessionId);
          return mcpText(session);
        }

        case "scale": {
          if (!input.sessionId) return mcpError("sessionId required for scale");
          if (input.maxAgents === undefined) return mcpError("maxAgents required for scale");
          const session = coordinator.scale(input.sessionId, input.maxAgents);
          return mcpText({ sessionId: session.id, maxAgents: session.maxAgents });
        }

        case "stop": {
          if (!input.sessionId) return mcpError("sessionId required for stop");
          const session = coordinator.stop(input.sessionId);
          return mcpText({ sessionId: session.id, status: session.status });
        }
      }
    } catch (err) {
      return mcpError(err instanceof Error ? err : String(err));
    }
  };
}

/** Actions that do not mutate state — used for future gate bypass. */
export const SWARM_READ_ONLY_ACTIONS: ReadonlySet<SwarmToolInput["action"]> = new Set(["status"]);

export function registerSwarm(server: McpServer, store: SqliteStore): void {
  const db: Database.Database = store.getDb();
  const handler = buildSwarmHandler(db);
  server.tool(
    "swarm",
    "Swarm coordination. Actions: init | start | scale | stop (mutating), status (read-only).",
    swarmInputSchema.shape,
    handler,
  );
}
