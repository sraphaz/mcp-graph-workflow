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
 * MCP tool: kanban — Kanban board visualization and orchestration.
 *
 * Actions:
 * - board: Display the Kanban board (ASCII columns with cards)
 * - move: Move a card to a new status
 * - suggestions: Get orchestration suggestions
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { buildKanbanBoard } from "../../core/kanban/kanban-builder.js";
import { generateSuggestions } from "../../core/kanban/kanban-orchestrator.js";
import { validateMove } from "../../core/kanban/kanban-validator.js";
import { DEFAULT_KANBAN_CONFIG, COLUMN_TITLES } from "../../core/kanban/kanban-types.js";
import type { KanbanBoard, KanbanConfig } from "../../core/kanban/kanban-types.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

const KANBAN_SETTINGS_KEY = "kanban_config";

function loadConfig(store: SqliteStore): KanbanConfig {
  try {
    const raw = store.getProjectSetting(KANBAN_SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as KanbanConfig;
  } catch { /* use defaults */ }
  return { ...DEFAULT_KANBAN_CONFIG };
}

function formatBoard(board: KanbanBoard): string {
  const lines: string[] = ["# Kanban Board", ""];

  for (const col of board.columns) {
    const wipInfo = col.wipLimit > 0 ? ` [${col.cards.length}/${col.wipLimit}]` : ` [${col.cards.length}]`;
    const violation = col.wipLimit > 0 && col.cards.length > col.wipLimit ? " *** WIP EXCEEDED ***" : "";
    lines.push(`## ${col.title}${wipInfo}${violation}`);

    if (col.cards.length === 0) {
      lines.push("  (empty)");
    } else {
      for (const card of col.cards) {
        const badges: string[] = [];
        if (card.isNext) badges.push("[NEXT]");
        badges.push(`P${card.node.priority}`);
        if (card.node.xpSize) badges.push(card.node.xpSize);
        if (card.blockerCount > 0) badges.push(`${card.blockerCount} blocker(s)`);
        if (card.epicTitle) badges.push(`Epic: ${card.epicTitle}`);

        lines.push(`  - ${card.node.title} (${badges.join(", ")})`);
      }
    }
    lines.push("");
  }

  // Metrics
  const m = board.metrics;
  lines.push("## Metrics");
  lines.push(`  Throughput: ${m.throughput} done`);
  lines.push(`  Avg Cycle Time: ${m.avgCycleTime > 0 ? `${m.avgCycleTime}h` : "—"}`);
  lines.push(`  Blocked: ${m.blockedPercentage}%`);
  if (m.wipViolations.length > 0) {
    lines.push(`  WIP Violations: ${m.wipViolations.map((v) => `${COLUMN_TITLES[v.column]} ${v.actual}/${v.limit}`).join(", ")}`);
  }

  return lines.join("\n");
}

export function registerKanban(server: McpServer, store: SqliteStore): void {
  server.tool(
    "kanban",
    "Kanban board visualization and orchestration. Actions: 'board' (view), 'move' (move card), 'suggestions' (get smart suggestions).",
    {
      action: z.enum(["board", "move", "suggestions"]).describe("Action to perform"),
      nodeId: z.string().optional().describe("Node ID (required for 'move')"),
      newStatus: z.enum(["backlog", "ready", "in_progress", "blocked", "done"]).optional().describe("New status (required for 'move')"),
      swimlane: z.enum(["none", "epic", "sprint"]).optional().describe("Swimlane grouping mode (for 'board')"),
    },
    async ({ action, nodeId, newStatus, swimlane }) => {
      logger.debug("tool:kanban", { action, nodeId, newStatus, swimlane });

      const config = loadConfig(store);
      if (swimlane) {
        config.swimlaneMode = swimlane;
      }

      if (action === "board") {
        const doc = store.toGraphDocument();
        const board = buildKanbanBoard(doc, config);
        return mcpText({
          ok: true,
          action: "board",
          board: formatBoard(board),
          metrics: board.metrics,
          swimlanes: board.swimlanes,
        });
      }

      if (action === "move") {
        if (!nodeId || !newStatus) {
          return mcpText({ ok: false, error: "nodeId and newStatus are required for 'move' action" });
        }

        const result = validateMove(store, nodeId, newStatus, config);
        if (!result.success) {
          return mcpText({ ok: false, ...result });
        }

        store.updateNodeStatus(nodeId, newStatus);
        return mcpText({
          ok: true,
          action: "move",
          ...result,
        });
      }

      if (action === "suggestions") {
        const doc = store.toGraphDocument();
        const board = buildKanbanBoard(doc, config);
        const suggestions = generateSuggestions(doc, board);
        return mcpText({
          ok: true,
          action: "suggestions",
          count: suggestions.length,
          suggestions,
        });
      }

      return mcpText({ ok: false, error: `Unknown action: ${action}` });
    },
  );
}
