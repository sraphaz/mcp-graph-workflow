/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { AgentRegistry } from "../../core/store/agent-registry.js";
import { listAgents } from "../../core/agents/agent-format-generator.js";
import { mcpText, mcpError, type McpToolResponse } from "../response-helpers.js";
import { logger } from "../../core/utils/logger.js";

// Phases where agent spawning is allowed
const SPAWN_ALLOWED_PHASES = new Set(["IMPLEMENT", "VALIDATE"]);

export const agentInputSchema = z.object({
  action: z.enum(["list", "describe", "metrics", "spawn"]).describe(
    "Agent action — list/describe/metrics are read-only; spawn is mutating.",
  ),
  agentName: z.string().optional().describe("Agent name (describe/spawn)"),
  phase: z.string().optional().describe("Target phase for spawn validation"),
});

export type AgentToolInput = z.infer<typeof agentInputSchema>;

export const AGENT_READ_ONLY_ACTIONS: ReadonlySet<AgentToolInput["action"]> = new Set(["list", "describe", "metrics"]);

/** buildAgentHandler — auto-generated description placeholder. */
export function buildAgentHandler(store: SqliteStore): (input: AgentToolInput) => Promise<McpToolResponse> {
  const registry = new AgentRegistry(store.getDb());

  return async (input) => {
    try {
      switch (input.action) {
        case "list": {
          const catalogAgents = listAgents();
          const liveAgents = registry.listAgents();
          return mcpText({
            ok: true,
            agents: catalogAgents,
            liveAgents,
            count: catalogAgents.length,
          });
        }

        case "describe": {
          if (!input.agentName) return mcpError("agentName required for describe");
          const catalog = listAgents();
          const found = catalog.find((a) => a.name === input.agentName);
          if (!found) {
            return mcpError(`Agent "${input.agentName}" not found in catalog`);
          }
          const live = registry.listAgents().find((a) => a.agentId === input.agentName);
          return mcpText({ ok: true, agent: found, liveStatus: live ?? null });
        }

        case "metrics": {
          const liveAgents = registry.listAgents();
          const activeCount = liveAgents.filter((a) => a.status === "active").length;
          const totalLocks = liveAgents.reduce((sum, a) => sum + a.activeLocks, 0);
          return mcpText({
            ok: true,
            summary: {
              totalRegistered: liveAgents.length,
              active: activeCount,
              inactive: liveAgents.length - activeCount,
              totalActiveLocks: totalLocks,
            },
            agents: liveAgents,
          });
        }

        case "spawn": {
          if (!input.agentName) return mcpError("agentName required for spawn");

          const currentPhase = store.getProjectSetting("lifecycle_phase_override") ?? "IMPLEMENT";
          if (!SPAWN_ALLOWED_PHASES.has(currentPhase)) {
            return mcpError(
              `spawn is not allowed in phase "${currentPhase}". ` +
              `Allowed phases: ${[...SPAWN_ALLOWED_PHASES].join(", ")}`,
            );
          }

          registry.registerAgent(input.agentName, [input.phase ?? currentPhase]);
          logger.info("agent-tool:spawn", { agentName: input.agentName, phase: currentPhase });
          return mcpText({
            ok: true,
            spawned: input.agentName,
            phase: currentPhase,
          });
        }

        default:
          return mcpError(`Unknown action: ${String(input.action)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("agent-tool:error", { action: input.action, error: msg });
      return mcpError(msg);
    }
  };
}

/** registerAgent — auto-generated description placeholder. */
export function registerAgent(server: McpServer, store: SqliteStore): void {
  server.tool(
    "agent",
    "Manage lifecycle agents. Actions: list, describe, metrics (read-only); spawn (mutating).",
    agentInputSchema.shape,
    async (params) => buildAgentHandler(store)(params as AgentToolInput),
  );
}
