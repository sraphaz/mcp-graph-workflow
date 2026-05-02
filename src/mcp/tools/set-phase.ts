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
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { setPhaseCore } from "../../core/planner/set-phase-core.js";
import { mcpText, mcpError } from "../response-helpers.js";

const VALID_PHASES = [
  "ANALYZE",
  "DESIGN",
  "PLAN",
  "IMPLEMENT",
  "VALIDATE",
  "REVIEW",
  "HANDOFF",
  "DEPLOY",
  "LISTENING",
  "auto",
] as const;

/** registerSetPhase — auto-generated description placeholder. */
export function registerSetPhase(server: McpServer, store: SqliteStore): void {
  server.tool(
    "set_phase",
    "Override lifecycle phase detection or reset to auto-detection. Use mode to switch between strict/advisory enforcement.",
    {
      phase: z.enum(VALID_PHASES).describe(
        "Lifecycle phase to force, or 'auto' to reset to automatic detection",
      ),
      force: z.boolean().optional().describe(
        "Force phase transition even if gate conditions are not met (strict mode only)",
      ),
      mode: z.enum(["strict", "advisory"]).optional().describe(
        "Set lifecycle enforcement mode: 'strict' blocks tools, 'advisory' only warns",
      ),
      codeIntelligence: z.enum(["strict", "advisory", "off"]).optional().describe(
        "Code Intelligence enforcement: 'strict' blocks mutating tools if index empty, 'advisory' warns, 'off' disables",
      ),
      prerequisites: z.enum(["strict", "advisory", "off"]).optional().describe(
        "Tool prerequisites enforcement: 'strict' blocks tools if mandatory prerequisites not called, 'advisory' warns, 'off' disables",
      ),
      teamTask: z.boolean().optional().describe(
        "Enable/disable multi-terminal teamTask mode — activates lock-based task claiming, agent registration, and ownership verification",
      ),
      wipStrict: z.boolean().optional().describe(
        "WIP gate strictness: true blocks start_task when WIP limit exceeded, false warns only. Defaults to true when teamTask is on.",
      ),
      maxInFlight: z.number().int().min(1).optional().describe(
        "Maximum number of concurrent in-flight tasks across all agents (wip_max_in_flight). Default: 3.",
      ),
      autopilot: z.boolean().optional().describe(
        "Enable/disable autonomous sprint execution — activates confidence-gated autopilot with safety guardrails",
      ),
      sprintId: z.string().optional().describe(
        "Sprint identifier for autopilot session tracking",
      ),
    },
    async (input) => {
      const resultValue = setPhaseCore(store, input);
      if (!resultValue.ok) {
        return mcpError(resultValue.error);
      }
      const { ok, ...payload } = resultValue;
      return mcpText({ ok, ...payload });
    },
  );
}
