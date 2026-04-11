import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  monitorGraph,
  analyzeIssues,
  planActions,
  executeActions,
  buildKnowledge,
  DEFAULT_HEALING_CONFIG,
} from "../../core/skills/self-healing-engine.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerSelfHealing(server: McpServer, store: SqliteStore): void {
  server.tool(
    "self_healing",
    "Self-healing MAPE-K engine: scan the graph for stuck tasks, broken dependencies, cycles, orphans, and other issues. " +
    "Actions: 'scan' (detect issues), 'diagnose' (detect + prioritize), 'heal' (full MAPE-K loop with optional auto-fix), 'report' (last healing report).",
    {
      action: z.enum(["scan", "diagnose", "heal", "report"]).describe(
        "scan = detect issues only; diagnose = detect + analyze; heal = full MAPE-K loop; report = last healing metrics",
      ),
      dryRun: z.boolean().optional().default(true).describe(
        "When true (default), heal actions are simulated but not applied. Set false to apply fixes.",
      ),
      staleHours: z.number().optional().default(48).describe(
        "Hours after which an in_progress task is considered stuck (default: 48).",
      ),
    },
    async ({ action, dryRun, staleHours }) => {
      logger.info("tool:self_healing", { action, dryRun, staleHours });

      try {
        const doc = store.toGraphDocument();
        const config = { ...DEFAULT_HEALING_CONFIG, staleHours: staleHours ?? 48, dryRun: dryRun ?? true };

        if (action === "scan") {
          const issues = monitorGraph(doc, config);
          logger.info("tool:self_healing:scan:ok", { issuesFound: issues.length });
          return mcpText({
            ok: true,
            action: "scan",
            issuesFound: issues.length,
            issues: issues.map((i) => ({
              type: i.type,
              severity: i.severity,
              nodeId: i.nodeId,
              title: i.title,
              message: i.message,
              suggestion: i.suggestion,
            })),
          });
        }

        if (action === "diagnose") {
          const issues = monitorGraph(doc, config);
          const analyzed = analyzeIssues(issues);
          const actions = planActions(analyzed, doc);
          logger.info("tool:self_healing:diagnose:ok", { issues: analyzed.length, actions: actions.length });
          return mcpText({
            ok: true,
            action: "diagnose",
            issuesFound: analyzed.length,
            actionsPlanned: actions.length,
            issues: analyzed.map((i) => ({
              type: i.type,
              severity: i.severity,
              nodeId: i.nodeId,
              title: i.title,
              message: i.message,
              suggestion: i.suggestion,
            })),
            plannedActions: actions.map((a) => ({
              type: a.type,
              nodeId: a.nodeId,
              description: a.description,
            })),
          });
        }

        if (action === "heal") {
          const issues = monitorGraph(doc, config);
          const analyzed = analyzeIssues(issues);
          const planned = planActions(analyzed, doc);
          const results = executeActions(planned, doc, { dryRun: config.dryRun });
          const report = buildKnowledge(issues, planned, results);

          logger.info("tool:self_healing:heal:ok", {
            issues: issues.length,
            actions: planned.length,
            successRate: report.metrics.successRate,
            dryRun: config.dryRun,
          });

          return mcpText({
            ok: true,
            action: "heal",
            dryRun: config.dryRun,
            report: {
              id: report.id,
              timestamp: report.timestamp,
              issuesDetected: report.metrics.totalIssuesDetected,
              totalHealed: report.metrics.totalHealed,
              totalFailed: report.metrics.totalFailed,
              successRate: report.metrics.successRate,
              bySeverity: report.metrics.bySeverity,
              byIssueType: report.metrics.byIssueType,
            },
            issues: report.issues.map((i) => ({
              type: i.type,
              severity: i.severity,
              nodeId: i.nodeId,
              title: i.title,
              message: i.message,
            })),
            actions: report.actions.map((a) => ({
              type: a.type,
              nodeId: a.nodeId,
              description: a.description,
            })),
            results: report.results.map((r) => ({
              success: r.success,
              message: r.message,
            })),
          });
        }

        // action === "report"
        logger.info("tool:self_healing:report", {});
        return mcpText({
          ok: true,
          action: "report",
          message: "Run self_healing with action='heal' first to generate a report.",
        });
      } catch (err) {
        logger.error("tool:self_healing:error", { error: String(err) });
        return mcpError(err instanceof Error ? err : new Error(String(err)));
      }
    },
  );
}
