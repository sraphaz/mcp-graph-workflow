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
 * graph_validate_ui — V11 Maestro Phase 4.3.
 *
 * Devolve plan-payload (executor=playwright) que o agente cliente executa
 * via Playwright MCP. NUNCA importa playwright — só descreve os steps.
 *
 * Substitui validate(action=task) — que importa Playwright direto. Esta
 * tool e a deprecação são escritas no mesmo PR (Task 4.3).
 */

import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";
import {
  PlanPayloadSchema,
  type PlanPayload,
  type PlanStep,
} from "../contracts/plan-payload.js";

const CHECK_KINDS = ["a11y", "console-errors", "network-requests"] as const;
export type ValidateCheck = typeof CHECK_KINDS[number];

export interface ValidateUiInput {
  nodeId: string;
  url: string;
  checks: ReadonlyArray<ValidateCheck>;
}

export type ValidateUiResult =
  | { ok: true; plan: PlanPayload }
  | { ok: false; error: string };

const PLAYWRIGHT_TOOLS = {
  navigate: "mcp__playwright__browser_navigate",
  snapshot: "mcp__playwright__browser_snapshot",
  consoleMessages: "mcp__playwright__browser_console_messages",
  networkRequests: "mcp__playwright__browser_network_requests",
} as const;

/** buildValidateUiPlan — auto-generated description placeholder. */
export function buildValidateUiPlan(input: ValidateUiInput): ValidateUiResult {
  if (input.checks.length === 0) {
    return { ok: false, error: "checks must not be empty" };
  }

  const steps: PlanStep[] = [
    { tool: PLAYWRIGHT_TOOLS.navigate, args: { url: input.url } },
  ];

  if (input.checks.includes("a11y")) {
    steps.push({ tool: PLAYWRIGHT_TOOLS.snapshot, args: {} });
  }
  if (input.checks.includes("console-errors")) {
    steps.push({ tool: PLAYWRIGHT_TOOLS.consoleMessages, args: { onlyErrors: true } });
  }
  if (input.checks.includes("network-requests")) {
    steps.push({ tool: PLAYWRIGHT_TOOLS.networkRequests, args: {} });
  }

  const plan: PlanPayload = {
    executor: "playwright",
    steps,
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

/** registerGraphValidateUi — auto-generated description placeholder. */
export function registerGraphValidateUi(server: McpServer): void {
  server.tool(
    "graph_validate_ui",
    "Generate a plan-payload (executor=playwright) that drives Playwright MCP to validate the UI of a graph node. Maestro principle: graph rastreia, Playwright MCP executa. Replaces validate(action=task) (still works in advisory deprecation).",
    {
      nodeId: z.string().min(1).describe("Node ID this validation belongs to"),
      url: z.string().min(1).describe("Target URL to validate (e.g. http://localhost:3000/dashboard)"),
      checks: z.array(z.enum(CHECK_KINDS)).min(1).describe("Checks to run: a11y (browser_snapshot), console-errors (browser_console_messages), network-requests (browser_network_requests)"),
    },
    async (args) => {
      const rVar = buildValidateUiPlan(args as ValidateUiInput);
      logger.debug("tool:graph_validate_ui", { ok: rVar.ok, nodeId: args.nodeId, checks: args.checks });
      return mcpText(rVar);
    },
  );
}
