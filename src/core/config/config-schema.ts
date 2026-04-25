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

import { z } from "zod/v4";
import { LspConfigOverrideSchema } from "../lsp/lsp-types.js";
import { BROWSER_PILOT_MODELS } from "../../schemas/browser-pilot.schema.js";

export const ContextModeSchema = z.enum(["ultra-lean", "lean", "full"]);
export type ContextMode = z.infer<typeof ContextModeSchema>;

/**
 * V11 Copilot Bridge — browser-use orchestration via Copilot LLM bridge.
 * Disabled by default; flipping `enabled=true` activates the
 * `browser_pilot_run` MCP tool. Plan: ~/.claude/plans/immutable-weaving-ocean.md.
 */
export const BrowserAutomationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  bridgeUrl: z.string().regex(/^https?:\/\//, "bridgeUrl must start with http:// or https://").default("http://127.0.0.1:9876/v1"),
  defaultModel: z.enum(BROWSER_PILOT_MODELS).default("claude-3.5-sonnet"),
  defaultCdpUrl: z.string().min(1).optional(),
  allowedDomains: z.array(z.string().min(1)).default([]),
  forbiddenCdpMethods: z.array(z.string().min(1)).default(["Browser.close"]),
  maxStepsDefault: z.number().int().min(1).max(100).default(25),
  tokenBudgetPerDay: z.number().int().nonnegative().optional(),
}).default({
  enabled: false,
  bridgeUrl: "http://127.0.0.1:9876/v1",
  defaultModel: "claude-3.5-sonnet",
  allowedDomains: [],
  forbiddenCdpMethods: ["Browser.close"],
  maxStepsDefault: 25,
});

export type BrowserAutomationConfig = z.infer<typeof BrowserAutomationConfigSchema>;

export const ConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  dbPath: z.string().default("workflow-graph"),
  basePath: z.string().optional(),
  contextMode: ContextModeSchema.default("lean"),
  dashboard: z
    .object({
      autoOpen: z.boolean().default(true),
    })
    .default({ autoOpen: true }),
  integrations: z
    .object({
      codeGraphAutoIndex: z.boolean().default(true),
      codeGraphReindexIntervalSec: z.number().int().min(0).default(0),
      lspServers: z.array(LspConfigOverrideSchema).default([]),
      browserAutomation: BrowserAutomationConfigSchema,
    })
    .prefault({}),
});

export type McpGraphConfig = z.infer<typeof ConfigSchema>;
