/**
 * MCP Tool — agent_format
 * Generate AI agent instructions in multiple formats. Actions: generate, list_formats, list_agents.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  generateAgentInstructions,
  listFormats,
  listAgents,
  type AgentFormat,
} from "../../core/agents/agent-format-generator.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

/* ------------------------------------------------------------------ */
/*  Handlers (exported for testing)                                    */
/* ------------------------------------------------------------------ */

export function handleAgentListFormats(): { ok: boolean; formats: Array<{ name: string; extension: string; description: string }> } {
  return { ok: true, formats: listFormats() };
}

export function handleAgentListAgents(): { ok: boolean; agents: Array<{ name: string; description: string; defaultFormat: string }> } {
  return { ok: true, agents: listAgents() };
}

export function handleAgentGenerate(params: {
  agentName: string;
  format: string;
  phase: string;
  constitutionPrinciples?: Array<{ title: string; description: string }>;
  relevantNodes?: Array<{ id: string; title: string; status: string }>;
}): { ok: boolean; output: string } {
  const output = generateAgentInstructions(
    params.agentName,
    params.format as AgentFormat,
    {
      phase: params.phase,
      constitutionPrinciples: params.constitutionPrinciples,
      relevantNodes: params.relevantNodes,
    },
  );

  return { ok: true, output };
}

/* ------------------------------------------------------------------ */
/*  MCP Registration                                                   */
/* ------------------------------------------------------------------ */

export function registerAgentFormat(server: McpServer, _store: SqliteStore): void {
  server.tool(
    "agent_format",
    "Generate AI agent instructions. Actions: generate, list_formats, list_agents.",
    {
      action: z.enum(["generate", "list_formats", "list_agents"]).describe("Action to perform"),
      agentName: z.string().optional().describe("Agent name (generate)"),
      format: z.enum(["markdown", "toml", "skill_md", "json"]).optional().describe("Output format (generate)"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "list_formats":
            return mcpText(handleAgentListFormats());

          case "list_agents":
            return mcpText(handleAgentListAgents());

          case "generate":
            if (!params.agentName) return mcpError("agentName required for generate");
            return mcpText(handleAgentGenerate({
              agentName: params.agentName,
              format: params.format ?? "markdown",
              phase: "IMPLEMENT",
            }));

          default:
            return mcpError(`Unknown action: ${params.action}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("Agent format tool error", { action: params.action, error: msg });
        return mcpError(msg);
      }
    },
  );
}
