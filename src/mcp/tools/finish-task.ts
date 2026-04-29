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
import { finishTask } from "../../core/pipeline/finish-task.js";
import { runQualityGates } from "../../core/pipeline/quality-gates-runner.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerFinishTask(server: McpServer, store: SqliteStore, lockManager?: LockManager): void {
  server.tool(
    "finish_task",
    "Pipeline: DoD check (9 checks) + AC validation + mark done + epic promotion + next task — all in 1 call. Replaces: analyze(implement_done) → validate(ac) → update_status(done).",
    {
      nodeId: z.string().min(1).describe("Task node ID to finish"),
      rationale: z.string().optional().describe("Decision rationale (indexed as AI decision for future RAG)"),
      testFiles: z.array(z.string()).optional().describe("Test file paths to associate with this task"),
      autoNext: z.boolean().optional().describe("Return next recommended task (default: true)"),
      qualityGates: z.array(z.string()).optional().describe("Optional quality gate modes to run: security_scan, code_quality, test_coverage, observability_check"),
      citations: z.array(z.object({
        docId: z.string(),
        sourceType: z.string(),
        snippet: z.string(),
        confidence: z.number(),
        chunkIndex: z.number(),
      })).optional().describe("RAG citations that informed the decision (provenance tracking)"),
      agentId: z.string().optional().describe("Agent ID for teamTask mode — verifies task ownership"),
      leaseToken: z.string().optional().describe("Lease token from start_task — used to release the lock"),
      shadowBranch: z.string().optional().describe("Shadow branch name from start_task — merged on done, discarded on blocked"),
      artifacts: z.array(z.object({
        kind: z.enum(["diff", "file", "interface", "decision", "note"]),
        path: z.string().nullable().optional(),
        content: z.string(),
      })).optional().describe("v11 Context-Pollination: structured outputs to persist in subtask_artifacts. Optional — omit to keep v10 behavior."),
    },
    async ({ nodeId, rationale, testFiles, autoNext, qualityGates, citations, agentId, leaseToken, shadowBranch, artifacts }) => {
      logger.debug("tool:finish_task", { nodeId, rationale: rationale?.slice(0, 60), autoNext, qualityGates, agentId });

      const result = await finishTask(store, nodeId, { rationale, testFiles, autoNext, citations, agentId, leaseToken, lockManager, shadowBranch, artifacts });

      logger.info("tool:finish_task:ok", {
        nodeId,
        status: result.status,
        dodGrade: result.dodReport.grade,
        blockers: result.blockers.length,
        hasNext: result.nextTask !== null,
      });

      const response: Record<string, unknown> = {
        status: result.status,
        dodReport: {
          score: result.dodReport.score,
          grade: result.dodReport.grade,
          checks: result.dodReport.checks,
          summary: result.dodReport.summary,
        },
      };

      if (result.blockers.length > 0) {
        response.blockers = result.blockers;
        response.hint = "Fix the listed blockers and try again. Required DoD checks must pass before marking done.";
      }

      if (result.epicPromotion) {
        response.epicPromotion = result.epicPromotion;
      }

      if (result.nextTask) {
        response.nextTask = {
          node: result.nextTask.task.node,
          reason: result.nextTask.task.reason,
          knowledgeCoverage: result.nextTask.knowledgeCoverage,
          enhancedReason: result.nextTask.enhancedReason,
        };
      }

      if (result.decisionIndexed) {
        response.decisionIndexed = true;
      }

      if (result.harnessRegression) {
        response.harnessRegression = result.harnessRegression;
      }

      if (result.ruleSuggestions.length > 0) {
        response.ruleSuggestions = result.ruleSuggestions;
      }

      if (result.testGate) {
        response.testGate = result.testGate;
      }

      if (result.invariantResult && !result.invariantResult.passed) {
        response.invariantViolations = result.invariantResult.violations;
      }

      if (result.discoveredTestFiles && result.discoveredTestFiles.length > 0) {
        response.discoveredTestFiles = result.discoveredTestFiles;
      }

      // v11 Context-Pollination: expose persisted artifact ids for auditoria
      response.artifactIds = result.artifactIds;

      if (result.skillProposal) {
        response.skillProposal = result.skillProposal;
      }

      // Run optional quality gates (advisory mode — never blocks)
      if (qualityGates && qualityGates.length > 0) {
        const gatesResult = runQualityGates(process.cwd(), qualityGates);
        if (gatesResult) {
          response._quality_gates = gatesResult;
          logger.info("tool:finish_task:quality_gates", {
            modes: gatesResult.modes,
            overallScore: gatesResult.overallScore,
            overallGrade: gatesResult.overallGrade,
            warnings: gatesResult.warnings.length,
          });
        }
      }

      return mcpText(response);
    },
  );
}
