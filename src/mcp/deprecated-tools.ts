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
 * DEPRECATED_TOOLS — V11 Maestro Phase 5.1.
 *
 * Three-stage deprecation cycle with rollback flag:
 *   advisory → log silencioso, response normal (window for callCount=0 evidence)
 *   warning  → response inclui _deprecation_notice (visible to LLM/agent)
 *   removed  → estructured error with replacement (final state)
 *
 * Rollback: env var `MCP_GRAPH_LEGACY_TOOLS=on` downgrades any "removed"
 * entry to "advisory" so a regression can be unblocked while a fix
 * lands. (Decisão em ADR 0042 §gate-30d.)
 */

import { logger } from "../core/utils/logger.js";

export type DeprecationStage = "advisory" | "warning" | "removed";

export interface DeprecationEntry {
  stage: DeprecationStage;
  replacement: string;
  sinceVersion: string;
}

/**
 * Tools and their deprecation status. Add entries here when ready to start
 * the 30-day clock. Move to "warning" after 30d of callCount=0 telemetry,
 * and to "removed" after another 30d of warning visibility.
 */
export const DEPRECATED_TOOLS: Record<string, DeprecationEntry> = {
  davinci: {
    stage: "advisory",
    replacement: "Use graph_materialize for diagram artifacts; davinci's PingAccess→Java conversion will move to a focused tool after the 30-day gate proves it's unused.",
    sinceVersion: "v11.0",
  },
  siebel: {
    stage: "advisory",
    replacement: "Use graph_validate_ui or graph_explore_web depending on intent. siebel's domain-specific validation is being absorbed into the maestro's plan-payload pattern.",
    sinceVersion: "v11.0",
  },
  translate: {
    stage: "advisory",
    replacement: "If you need translation in tests, prefer the journey/capture pipeline. translate is scheduled for removal after the V11 telemetry gate.",
    sinceVersion: "v11.0",
  },
  forecast: {
    stage: "advisory",
    replacement: "Use metrics({mode: \"dora_metrics\"}) — same DORA payload, lives in the metrics tool now.",
    sinceVersion: "v11.0",
  },
  sync_stack_docs: {
    stage: "advisory",
    replacement: "Use graph_refresh_docs — identical behavior, consistent graph_* namespace.",
    sinceVersion: "v11.0",
  },
};

/**
 * Resolve a tool's deprecation status, applying the rollback env flag.
 *
 * @param toolName       — the tool that was just invoked
 * @param overrideEntry  — testing hook; ignores DEPRECATED_TOOLS map
 */
export function resolveDeprecation(
  toolName: string,
  overrideEntry?: DeprecationEntry,
): DeprecationEntry | null {
  const entry = overrideEntry ?? DEPRECATED_TOOLS[toolName];
  if (!entry) return null;

  // Rollback: when MCP_GRAPH_LEGACY_TOOLS=on, "removed" tools are temporarily
  // downgraded to "advisory" so a hard regression can be unblocked.
  if (entry.stage === "removed" && process.env.MCP_GRAPH_LEGACY_TOOLS === "on") {
    return { ...entry, stage: "advisory" };
  }
  return entry;
}

/**
 * Structured error response for a "removed" tool — surfaces the replacement
 * and the rollback flag so users can recover quickly.
 */
export function buildRemovedResponse(toolName: string, entry: DeprecationEntry): {
  ok: false;
  error: string;
  replacement: string;
  rollback: string;
} {
  return {
    ok: false,
    error: `Tool '${toolName}' was removed in ${entry.sinceVersion}. ${entry.replacement}`,
    replacement: entry.replacement,
    rollback: "Set MCP_GRAPH_LEGACY_TOOLS=on to temporarily re-enable the tool in advisory mode (emergency only).",
  };
}

/**
 * Attach a `_deprecation_notice` field to a successful tool response when the
 * tool is in "warning" stage. No-op for "advisory" (we just log silently) and
 * "removed" (those are intercepted before the handler runs).
 */
export function attachDeprecationNotice<T extends Record<string, unknown>>(
  response: T,
  toolName: string,
  entry: DeprecationEntry,
): T & { _deprecation_notice?: string } {
  if (entry.stage !== "warning") {
    if (entry.stage === "advisory") {
      logger.debug("deprecated-tool:advisory", { tool: toolName, sinceVersion: entry.sinceVersion });
    }
    return response;
  }
  return {
    ...response,
    _deprecation_notice: `Tool '${toolName}' is deprecated (${entry.sinceVersion}). ${entry.replacement}`,
  };
}
