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
import { startTask } from "../../core/pipeline/start-task.js";
import { AmbiguityAuditSchema } from "../../core/decisions/ambiguity-audit-types.js";
import { createLogger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

const log = createLogger({ layer: "mcp", source: "start-task.ts" });

/** registerStartTask — auto-generated description placeholder. */
export function registerStartTask(server: McpServer, store: SqliteStore, lockManager?: LockManager): void {
  server.tool(
    "start_task",
    "Pipeline: find next task + load context + RAG + TDD hints + mark in_progress — all in 1 call. Replaces: next → context → context(rag) → update_status(in_progress).",
    {
      nodeId: z.string().optional().describe("Specific task ID (or auto via next)"),
      contextDetail: z.enum(["summary", "standard", "deep"]).optional().describe("RAG detail tier (default: standard)"),
      ragBudget: z.number().min(500).max(32000).optional().describe("Token budget for RAG context (default: 4000)"),
      autoStart: z.boolean().optional().describe("Auto-mark task in_progress (default: true)"),
      agentId: z.string().optional().describe("Agent ID for teamTask mode — enables exclusive task claiming"),
      siblingBudget: z.number().min(0).max(200000).optional().describe("v11 Context-Pollination: token budget cap for siblingContext (default: 4000)"),
      ambiguityAudit: AmbiguityAuditSchema.optional().describe("§EPIC-13.2 — Pre-execution self-audit classifying ACs as specified/partial/unspecified. Persisted in node.metadata.ambiguityAudit."),
    },
    async ({ nodeId, contextDetail, ragBudget, autoStart, agentId, siblingBudget, ambiguityAudit }) => {
      log.debug("tool:start_task", { nodeId, contextDetail, ragBudget, autoStart, agentId, siblingBudget, hasAmbiguityAudit: !!ambiguityAudit });

      const resultValue = startTask(store, {
        nodeId, contextDetail, ragBudget, autoStart,
        agentId,
        lockManager,
        siblingBudget,
        ambiguityAudit,
      });

      if (!resultValue) {
        log.info("tool:start_task:no_tasks");
        return mcpText({
          message: "No actionable tasks found. All tasks are either done or blocked.",
        });
      }

      log.info("tool:start_task:ok", {
        nodeId: resultValue.task.task.node.id,
        title: resultValue.task.task.node.title,
        autoStart: resultValue.startedAt !== null,
        tddHints: resultValue.tddHints.length,
      });

      return mcpText({
        node: resultValue.task.task.node,
        reason: resultValue.task.task.reason,
        knowledgeCoverage: resultValue.task.knowledgeCoverage,
        velocityContext: resultValue.task.velocityContext,
        enhancedReason: resultValue.task.enhancedReason,
        tddHints: resultValue.tddHints,
        context: resultValue.context,
        ragContext: resultValue.ragContext,
        startedAt: resultValue.startedAt,
        ...(resultValue.harnessWarning ? { harnessWarning: resultValue.harnessWarning } : {}),
        ...(resultValue.leaseToken ? { leaseToken: resultValue.leaseToken } : {}),
        ...(resultValue.checkpoint ? { checkpoint: { snapshotId: resultValue.checkpoint.snapshotId } } : {}),
        ...(resultValue.shadowBranch ? { shadowBranch: resultValue.shadowBranch } : {}),
        ...(resultValue.modelHint ? { modelHint: resultValue.modelHint } : {}),
        siblingContext: resultValue.siblingContext,
        ...(resultValue.siblingTruncatedCount > 0 ? { siblingTruncatedCount: resultValue.siblingTruncatedCount } : {}),
        ...(resultValue.domainSkills.length > 0 ? { domainSkills: resultValue.domainSkills } : {}),
        ...(resultValue.ambiguityAuditWarning ? { ambiguityAuditWarning: resultValue.ambiguityAuditWarning } : {}),
        ...(resultValue.memoryDynamicsTick ? { _memoryDynamicsTick: resultValue.memoryDynamicsTick } : {}),
      });
    },
  );
}
