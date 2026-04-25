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
 * DEPRECATED_MODES — V11 Maestro mode-deprecation gate.
 *
 * `DEPRECATED_TOOLS` operates at tool granularity. Some tools (notably
 * `analyze`) carry many modes; orphan modes (cfd, code_sync,
 * economy_simulation) need their own deprecation cycle. This module
 * mirrors the 3-stage semantics for `(toolName, modeArg)` pairs.
 *
 * Same rollback flag: `MCP_GRAPH_LEGACY_TOOLS=on` downgrades any
 * "removed" mode entry to "advisory".
 */

import type { DeprecationEntry } from "./deprecated-tools.js";

/**
 * Tool → mode → deprecation entry. Only orphan modes appear here; any
 * (tool, mode) pair NOT listed is treated as healthy.
 */
export const DEPRECATED_MODES: Record<string, Record<string, DeprecationEntry>> = {
  analyze: {
    cfd: {
      stage: "advisory",
      replacement: "Cumulative-flow diagrams are now exported via export({action:'mermaid', format:'gantt'}) or the dashboard. cfd is scheduled for removal after the 30-day telemetry gate.",
      sinceVersion: "v11.0",
    },
    code_sync: {
      stage: "advisory",
      replacement: "Code intelligence sync is now handled by code_intelligence({action:'reindex'}). The legacy code_sync mode duplicates that path.",
      sinceVersion: "v11.0",
    },
    economy_simulation: {
      stage: "advisory",
      replacement: "Economy simulation was a research artifact and is unlikely to see production use. No 1:1 replacement; the helpers in src/core/analyzer/economy-simulator.ts remain importable for ad-hoc scripts.",
      sinceVersion: "v11.0",
    },
  },
};

/**
 * Pull `args[0].mode` from the MCP tool handler args tuple. Returns null
 * when the tool isn't called with a `{mode: string}` shape.
 */
export function extractModeFromArgs(args: ReadonlyArray<unknown>): string | null {
  if (args.length === 0) return null;
  const first = args[0];
  if (first === null || typeof first !== "object") return null;
  const mode = (first as { mode?: unknown }).mode;
  return typeof mode === "string" ? mode : null;
}

/**
 * Resolve the deprecation status of a `(toolName, mode)` pair, applying the
 * `MCP_GRAPH_LEGACY_TOOLS=on` rollback flag. Returns null when the pair is
 * healthy.
 *
 * @param toolName       — invoked tool
 * @param mode           — `args[0].mode` value
 * @param overrideEntry  — testing hook; ignores DEPRECATED_MODES map
 */
export function resolveModeDeprecation(
  toolName: string,
  mode: string,
  overrideEntry?: DeprecationEntry,
): DeprecationEntry | null {
  const entry = overrideEntry ?? DEPRECATED_MODES[toolName]?.[mode];
  if (!entry) return null;
  if (entry.stage === "removed" && process.env.MCP_GRAPH_LEGACY_TOOLS === "on") {
    return { ...entry, stage: "advisory" };
  }
  return entry;
}
