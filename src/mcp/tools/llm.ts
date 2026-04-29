/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP tool — `llm`. Surface for the MCP-Graph Proxy SDK (FR-5).
 * Actions: generate (mutating), list_models | budget_status | proxy_status (read-only).
 *
 * D.1a — skeleton only. Action handlers stay as placeholders until D.1b/D.1c.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpError, mcpText, type McpToolResponse } from "../response-helpers.js";
import type { LlmGateway } from "../../core/llm/gateway.js";
import type { CallContext, LlmRequest } from "../../core/llm/types.js";

export const llmInputSchema = z.object({
  action: z
    .enum(["generate", "list_models", "budget_status", "proxy_status", "failover_status"])
    .describe("Tool action — generate is mutating; the others are read-only."),
  // generate
  model: z.string().optional().describe("Model id (e.g. anthropic/claude-haiku-4-5)"),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional()
    .describe("Chat messages (generate)"),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  // call context
  caller: z.string().optional().describe("Caller id for ledger (default: 'mcp-tool')"),
  cellId: z.string().optional().describe("Graph node id correlation"),
  runId: z.string().optional(),
  // list_models
  allowExpensive: z.boolean().optional(),
  tier: z.enum(["cheap", "mid", "expensive"]).optional(),
});

export type LlmToolInput = z.infer<typeof llmInputSchema>;

export const LLM_READ_ONLY_ACTIONS: ReadonlySet<LlmToolInput["action"]> = new Set([
  "list_models",
  "budget_status",
  "proxy_status",
  "failover_status",
]);

export interface LlmToolDeps {
  gateway?: LlmGateway;
}

export function buildLlmHandler(
  deps: LlmToolDeps,
): (params: LlmToolInput) => Promise<McpToolResponse> {
  return async (params) => {
    switch (params.action) {
      case "generate":
        return handleGenerate(deps, params);
      case "list_models":
        return handleListModels(deps, params);
      case "budget_status":
        return handleBudgetStatus(deps, params);
      case "proxy_status":
        return handleProxyStatus();
      case "failover_status":
        return handleFailoverStatus(deps);
    }
  };
}

function handleFailoverStatus(deps: LlmToolDeps): McpToolResponse {
  if (!deps.gateway) {
    return mcpError("llm.failover_status: gateway not configured");
  }
  const status = deps.gateway.failoverStatus();
  const payload = mcpText({ status });
  return { ...payload, structuredContent: { status } };
}

function handleListModels(deps: LlmToolDeps, params: LlmToolInput): McpToolResponse {
  if (!deps.gateway) {
    return mcpError("llm.list_models: gateway not configured");
  }
  const models = deps.gateway.listModels({
    allowExpensive: params.allowExpensive,
    tier: params.tier,
  });
  const payload = mcpText({ models });
  return { ...payload, structuredContent: { models } };
}

function handleBudgetStatus(deps: LlmToolDeps, params: LlmToolInput): McpToolResponse {
  if (!deps.gateway) {
    return mcpError("llm.budget_status: gateway not configured");
  }
  const aggregate = deps.gateway.budgetStatus({
    cellId: params.cellId,
    runId: params.runId,
  });
  const payload = mcpText({ aggregate });
  return { ...payload, structuredContent: { aggregate } };
}

function handleProxyStatus(): McpToolResponse {
  const status = {
    available: false,
    reason: "proxy not started — Fase E (HTTP server) not yet implemented",
  };
  const payload = mcpText(status);
  return { ...payload, structuredContent: status };
}

async function handleGenerate(
  deps: LlmToolDeps,
  params: LlmToolInput,
): Promise<McpToolResponse> {
  if (!deps.gateway) {
    return mcpError("llm.generate: gateway not configured (server not initialized with LlmGateway)");
  }
  if (!params.model) {
    return mcpError("llm.generate: model is required");
  }
  if (!params.messages || params.messages.length === 0) {
    return mcpError("llm.generate: messages must be non-empty");
  }
  const req: LlmRequest = {
    model: params.model,
    messages: params.messages,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
  };
  const ctx: CallContext = {
    caller: params.caller ?? "mcp-tool",
    cellId: params.cellId,
    runId: params.runId,
  };
  try {
    const response = await deps.gateway.generate(req, ctx);
    const payload = mcpText({
      content: response.content,
      model: response.model,
      usage: response.usage,
    });
    return {
      ...payload,
      structuredContent: {
        model: response.model,
        content: response.content,
        usage: response.usage,
      },
    };
  } catch (err) {
    const name = err instanceof Error ? err.constructor.name : "Error";
    const msg = err instanceof Error ? err.message : String(err);
    return mcpError(`${name}: ${msg}`);
  }
}

export function registerLlm(server: McpServer, deps: LlmToolDeps = {}): void {
  const handler = buildLlmHandler(deps);
  server.tool(
    "llm",
    "MCP-Graph Proxy LLM gateway. Actions: generate (mutating), list_models | budget_status | proxy_status (read-only).",
    llmInputSchema.shape,
    handler,
  );
}
