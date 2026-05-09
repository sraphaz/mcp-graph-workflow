/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-sentrux-adoption — Task 1.3: Wire 4 Sentrux MCP tools via adapter.
 *
 * Wraps scan, session_start, session_end, check_rules with Zod v4 parsing.
 * The McpCallFn is injectable for testing without a live Sentrux MCP server.
 */

import { createLogger } from "../utils/logger.js";
import { McpGraphError } from "../utils/errors.js";
import { z } from "zod/v4";
import {
  SentruxScanResultSchema,
  SentruxSessionStartResultSchema,
  SentruxSessionEndResultSchema,
  SentruxCheckRulesResultSchema,
  type SentruxScanResult,
  type SentruxSessionStartResult,
  type SentruxSessionEndResult,
  type SentruxCheckRulesResult,
} from "../../schemas/sentrux.schema.js";

const log = createLogger({ layer: "core", source: "sentrux-mcp-adapter.ts" });

export type McpCallFn = (tool: string, args: Record<string, unknown>) => Promise<unknown>;

async function defaultMcpCall(_tool: string, _args: Record<string, unknown>): Promise<unknown> {
  throw new McpGraphError("SentruxMcpAdapter: no MCP client configured — inject a McpCallFn for real calls");
}

function parseOrThrow<T>(tool: string, schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const issues = result.error.issues
    .map((i) => `${String(i.path.join("."))}: ${i.message}`)
    .join("; ");
  throw new McpGraphError(`sentrux:${tool} parse error — ${issues}`);
}

export class SentruxMcpAdapter {
  constructor(private readonly call: McpCallFn = defaultMcpCall) {}

  async scan(args: Record<string, unknown> = {}): Promise<SentruxScanResult> {
    const raw = await this.call("scan", args);
    const result = parseOrThrow("scan", SentruxScanResultSchema, raw);
    log.info("sentrux:scan", { runId: result.runId, severity: result.severity });
    return result;
  }

  async sessionStart(args: { label?: string } = {}): Promise<SentruxSessionStartResult> {
    const raw = await this.call("session_start", args as Record<string, unknown>);
    const result = parseOrThrow("session_start", SentruxSessionStartResultSchema, raw);
    log.info("sentrux:session_start", { sessionId: result.sessionId });
    return result;
  }

  async sessionEnd(args: { sessionId: string }): Promise<SentruxSessionEndResult> {
    const raw = await this.call("session_end", args as Record<string, unknown>);
    const result = parseOrThrow("session_end", SentruxSessionEndResultSchema, raw);
    log.info("sentrux:session_end", { sessionId: result.sessionId, issuesDelta: result.issuesDelta });
    return result;
  }

  async checkRules(args: Record<string, unknown> = {}): Promise<SentruxCheckRulesResult> {
    const raw = await this.call("check_rules", args);
    const result = parseOrThrow("check_rules", SentruxCheckRulesResultSchema, raw);
    log.info("sentrux:check_rules", { totalCount: result.totalCount });
    return result;
  }
}
