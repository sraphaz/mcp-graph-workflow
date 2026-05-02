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
import type { LockManager } from "../../core/store/lock-manager.js";
import { findEnhancedNextTask } from "../../core/planner/enhanced-next.js";
import { generateTddHints, generateTddHintsFromTexts } from "../../core/implementer/tdd-checker.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

/** registerNext — auto-generated description placeholder. */
export function registerNext(server: McpServer, store: SqliteStore, lockManager?: LockManager): void {
  server.tool(
    "next",
    "Suggest the next best task to work on based on priority, dependencies, size, knowledge coverage, and velocity. Includes TDD hints from acceptance criteria. In teamTask mode, excludes tasks locked by other agents.",
    {
      agentId: z.string().optional().describe("Agent ID for teamTask mode — excludes tasks locked by other agents"),
    },
    async ({ agentId }) => {
      logger.debug("tool:next", { agentId });
      const doc = store.toGraphDocument();
      const resultValue = findEnhancedNextTask(doc, store, { lockManager, agentId });

      if (!resultValue) {
        logger.info("tool:next:ok", { found: false });
        return mcpText({
          message: "No actionable tasks found. All tasks are either done or blocked.",
        });
      }

      // Collect AC from both inline and child nodes
      const acChildNodes = doc.nodes.filter(
        (n) => n.type === "acceptance_criteria" && n.parentId === resultValue.task.node.id,
      );
      const acTexts = [
        ...(resultValue.task.node.acceptanceCriteria ?? []),
        ...acChildNodes.map((n) => n.title),
      ];
      const tddHints = acTexts.length > 0
        ? generateTddHintsFromTexts(acTexts)
        : generateTddHints(resultValue.task.node);

      logger.info("tool:next:ok", {
        found: true,
        nodeId: resultValue.task.node.id,
        knowledgeCoverage: resultValue.knowledgeCoverage,
        tddHints: tddHints.length,
      });

      return mcpText({
        node: resultValue.task.node,
        reason: resultValue.task.reason,
        knowledgeCoverage: resultValue.knowledgeCoverage,
        velocityContext: resultValue.velocityContext,
        enhancedReason: resultValue.enhancedReason,
        tddHints,
      });
    },
  );
}
