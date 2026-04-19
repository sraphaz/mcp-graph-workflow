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
import { generatePlanningReport } from "../../core/planner/planning-report.js";
import { findEnhancedNextTask } from "../../core/planner/enhanced-next.js";
import { autoDecomposeLarge } from "../../core/planner/auto-decompose.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexEntitiesForDoc } from "../../core/rag/entity-index-hook.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerPlanSprint(server: McpServer, store: SqliteStore): void {
  server.tool(
    "plan_sprint",
    "Generate a sprint planning report with recommended task order, missing docs, risk assessment, and velocity-based estimates.",
    {
      mode: z
        .enum(["report", "next"])
        .optional()
        .describe("Mode: 'report' for full planning report, 'next' for enhanced next task (default: report)"),
      capacityPoints: z
        .number()
        .optional()
        .describe("Max points per sprint — tasks exceeding this go to overflow"),
      autoDecompose: z
        .boolean()
        .optional()
        .describe("When true, L/XL tasks with 2-8 ACs and no children are split into subtasks before the report is generated. Opt-in (default: false)."),
    },
    async ({ mode, capacityPoints, autoDecompose }) => {
      logger.debug("tool:plan_sprint", { mode: mode ?? "report", autoDecompose });

      // Pre-process: auto-decompose large tasks so the report reflects the
      // post-split graph. Opt-in to avoid surprising users who hand-manage
      // their subtasks.
      let decomposition: ReturnType<typeof autoDecomposeLarge> | null = null;
      if (autoDecompose) {
        try {
          decomposition = autoDecomposeLarge(store);
          logger.info("tool:plan_sprint:auto_decompose", {
            decomposed: decomposition.decomposed.length,
            skipped: decomposition.skipped.length,
          });
        } catch (err) {
          logger.warn("tool:plan_sprint:auto_decompose_failed", { error: String(err) });
        }
      }

      const doc = store.toGraphDocument();

      if (mode === "next") {
        const result = findEnhancedNextTask(doc, store);

        if (!result) {
          return mcpText({ message: "No tasks available" });
        }

        logger.info("tool:plan_sprint:ok", { mode: "next", taskId: result.task.node.id });
        return mcpText({
          task: {
            id: result.task.node.id,
            title: result.task.node.title,
            type: result.task.node.type,
            priority: result.task.node.priority,
            xpSize: result.task.node.xpSize,
          },
          knowledgeCoverage: result.knowledgeCoverage,
          velocityContext: result.velocityContext,
          enhancedReason: result.enhancedReason,
        });
      }

      // Default: full planning report
      const report = generatePlanningReport(doc, store, mode === "report" || mode === undefined ? capacityPoints : undefined);

      // Index sprint plan into knowledge store for cross-phase RAG
      try {
        const knowledgeStore = new KnowledgeStore(store.getDb());
        const planText = JSON.stringify(report);
        const sourceId = `sprint_plan:${new Date().toISOString()}`;
        const taskCount = report.recommendedOrder.length;
        const velocity = report.summary.avgVelocity ?? 0;
        const capacity = report.summary.estimatedPoints;

        const sprintDoc = knowledgeStore.insert({
          sourceType: "sprint_plan",
          sourceId,
          title: "Sprint Planning Report",
          content: planText.length > 4000 ? planText.slice(0, 4000) : planText,
          metadata: {
            phase: "PLAN",
            generatedAt: new Date().toISOString(),
            taskCount,
            velocity,
            capacity,
          },
        });
        indexEntitiesForDoc(store.getDb(), sprintDoc.id);
      } catch (err) {
        logger.warn("tool:plan_sprint:knowledge_index_failed", { error: String(err) });
      }

      logger.info("tool:plan_sprint:ok", { mode: "report" });
      return mcpText({
        ...report,
        ...(decomposition ? { autoDecomposition: decomposition } : {}),
      });
    },
  );
}
