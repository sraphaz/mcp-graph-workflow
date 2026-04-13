import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { finishTask } from "../../core/pipeline/finish-task.js";
import { runQualityGates } from "../../core/pipeline/quality-gates-runner.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerFinishTask(server: McpServer, store: SqliteStore): void {
  server.tool(
    "finish_task",
    "Pipeline: DoD check (9 checks) + AC validation + mark done + epic promotion + next task — all in 1 call. Replaces: analyze(implement_done) → validate(ac) → update_status(done).",
    {
      nodeId: z.string().min(1).describe("Task node ID to finish"),
      rationale: z.string().optional().describe("Decision rationale (indexed as AI decision for future RAG)"),
      testFiles: z.array(z.string()).optional().describe("Test file paths to associate with this task"),
      autoNext: z.boolean().optional().describe("Return next recommended task (default: true)"),
      qualityGates: z.array(z.string()).optional().describe("Optional quality gate modes to run: security_scan, code_quality, test_coverage, observability_check"),
    },
    async ({ nodeId, rationale, testFiles, autoNext, qualityGates }) => {
      logger.debug("tool:finish_task", { nodeId, rationale: rationale?.slice(0, 60), autoNext, qualityGates });

      const result = finishTask(store, nodeId, { rationale, testFiles, autoNext });

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
