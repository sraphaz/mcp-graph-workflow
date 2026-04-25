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
 * Unified-gate telemetry helper (V11 Maestro Phase 1).
 *
 * Wraps `ToolTokenStore.recordCall` with two responsibilities:
 *   1. Honor the `MCP_GRAPH_TELEMETRY=off` rollback flag.
 *   2. Fail-silent — telemetry must NEVER break tool execution.
 *
 * Used by `unified-gate.ts` after each tool handler runs (success or failure).
 */

import type { SqliteStore } from "../core/store/sqlite-store.js";
import { ToolTokenStore } from "../core/store/tool-token-store.js";
import { logger } from "../core/utils/logger.js";

/** True when telemetry should record. False if `MCP_GRAPH_TELEMETRY=off`. */
export function isTelemetryEnabled(): boolean {
  return process.env.MCP_GRAPH_TELEMETRY !== "off";
}

/**
 * Classify a thrown value into a stable error kind for telemetry aggregation.
 * Avoids leaking error messages — only the constructor name is recorded.
 */
export function classifyError(err: unknown): string {
  if (err instanceof Error) {
    return err.name && err.name.length > 0 ? err.name : "Error";
  }
  return "unknown";
}

/**
 * Record a tool call's telemetry payload. No-op when disabled or when no project
 * is initialized. Never throws — telemetry failure is logged at debug level only.
 *
 * @param store      — SqliteStore (must already be initialized)
 * @param toolName   — name of the MCP tool that was invoked
 * @param inputTokens  — estimated input tokens (caller computes)
 * @param outputTokens — estimated output tokens (caller computes; 0 on error)
 * @param success    — true if handler returned normally; false if it threw
 * @param durationMs — wall-clock duration of the handler
 * @param errorKind  — only set when success=false (e.g. "TimeoutError")
 */
export function recordToolCallTelemetry(
  store: SqliteStore,
  toolName: string,
  inputTokens: number,
  outputTokens: number,
  success: boolean,
  durationMs: number,
  errorKind?: string,
): void {
  if (!isTelemetryEnabled()) return;
  try {
    const project = store.getProject();
    if (!project) return;
    const tokenStore = new ToolTokenStore(store.getDb());
    tokenStore.recordCall(project.id, toolName, {
      inputTokens,
      outputTokens,
      success,
      durationMs,
      errorKind,
    });
  } catch (err) {
    logger.debug("unified-gate-telemetry: record skipped (fail-silent)", {
      toolName,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}
