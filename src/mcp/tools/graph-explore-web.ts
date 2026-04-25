/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * graph_explore_web — V11 Maestro Phase 4.4.
 *
 * Devolve plan-payload (executor=browser-use) que dispara o Browser Use MCP
 * com goal/maxSteps/rubric. NUNCA importa o pacote browser_use — só descreve
 * o step que o agente cliente executa.
 *
 * Falha graciosa: quando BROWSER_USE_MCP_AVAILABLE=false, retorna um erro
 * orientado com a instrução `claude mcp add browser-use ...` em vez de
 * propagar para o caller (o usuário pode não ter o MCP instalado).
 */

import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";
import {
  PlanPayloadSchema,
  type PlanPayload,
} from "../contracts/plan-payload.js";

export interface ExploreWebInput {
  nodeId: string;
  goal: string;
  maxSteps: number;
  rubric: string;
}

export type ExploreWebResult =
  | { ok: true; plan: PlanPayload }
  | { ok: false; error: string };

const BROWSER_USE_TOOL = "mcp__browser_use__browser_use_run";

const INSTALL_HINT =
  "Browser Use MCP not available. Install via:\n" +
  "  claude mcp add browser-use uvx browser-use-mcp\n" +
  "Then set OPENAI_API_KEY or ANTHROPIC_API_KEY in env.";

export function buildExploreWebPlan(input: ExploreWebInput): ExploreWebResult {
  if (!input.goal || input.goal.trim().length === 0) {
    return { ok: false, error: "goal must not be empty" };
  }
  if (!input.maxSteps || input.maxSteps <= 0) {
    return { ok: false, error: "maxSteps must be a positive integer" };
  }

  if (process.env.BROWSER_USE_MCP_AVAILABLE === "false") {
    return { ok: false, error: INSTALL_HINT };
  }

  const plan: PlanPayload = {
    executor: "browser-use",
    steps: [
      {
        tool: BROWSER_USE_TOOL,
        args: {
          goal: input.goal,
          maxSteps: input.maxSteps,
          rubric: input.rubric,
        },
      },
    ],
    postCallback: {
      tool: "finish_task",
      args: { nodeId: input.nodeId },
    },
    auditId: randomUUID(),
    nodeId: input.nodeId,
  };

  const parsed = PlanPayloadSchema.safeParse(plan);
  if (!parsed.success) {
    return { ok: false, error: `Internal: built invalid PlanPayload: ${parsed.error.message}` };
  }
  return { ok: true, plan: parsed.data };
}

export function registerGraphExploreWeb(server: McpServer): void {
  server.tool(
    "graph_explore_web",
    "Generate a plan-payload (executor=browser-use) for agentic web exploration via Browser Use MCP. Returns an install hint when BROWSER_USE_MCP_AVAILABLE=false. Maestro principle: graph rastreia, Browser Use MCP executa.",
    {
      nodeId: z.string().min(1).describe("Node ID this exploration belongs to"),
      goal: z.string().min(1).describe("Natural-language goal for Browser Use (e.g. 'find the pricing page and extract the highest tier')"),
      maxSteps: z.number().int().positive().describe("Maximum browser actions Browser Use may perform"),
      rubric: z.string().min(1).describe("Success criterion for the agent loop (e.g. 'numeric price extracted from a *.com domain')"),
    },
    async (args) => {
      const r = buildExploreWebPlan(args);
      logger.debug("tool:graph_explore_web", { ok: r.ok, nodeId: args.nodeId });
      return mcpText(r);
    },
  );
}
