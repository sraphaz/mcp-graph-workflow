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
import { calculateVelocity } from "../../core/planner/velocity.js";
import { detectCurrentPhase, type LifecyclePhase } from "../../core/planner/lifecycle-phase.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { buildTaskContext } from "../../core/context/compact-context.js";
import { runHarnessScanCached } from "../../core/harness/harness-cache.js";
import { RecoveryMetricsStore } from "../../core/autonomy/recovery-metrics-store.js";
import { ToolTokenStore, type UsageStats } from "../../core/store/tool-token-store.js";
import { calculateCost } from "../../core/observability/cost-tracker.js";
import { calculateDoraMetrics } from "../../core/insights/dora-metrics.js";
import { createLogger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

const log = createLogger({ layer: "mcp", source: "metrics.ts" });

/**
 * Response shape for `metrics({mode: "dora_metrics"})` — V11 Maestro Phase 5.4.
 * Replaces forecast(mode="dora") with the same payload so callers can migrate
 * without behavior change.
 */
export interface DoraMetricsResponse {
  ok: boolean;
  mode: "dora_metrics";
  error?: string;
  metrics: ReturnType<typeof calculateDoraMetrics>;
  interpretation: {
    deploymentFrequency: string;
    leadTime: string;
    changeFailureRate: string;
    mttr: string;
  };
}

/**
 * Pure helper — backs `metrics({mode: "dora_metrics"})`. The interpretation
 * thresholds are kept identical to forecast.ts to make migration a no-op
 * for downstream consumers.
 */
export function buildDoraMetricsResponse(store: SqliteStore): DoraMetricsResponse {
  const project = store.getProject();
  const metrics = calculateDoraMetrics(store);
  const interpretation = {
    deploymentFrequency: metrics.deploymentFrequency > 2
      ? "Elite: >2 tasks/day"
      : metrics.deploymentFrequency > 0.5
        ? "High: >0.5 tasks/day"
        : "Needs improvement: <0.5 tasks/day",
    leadTime: metrics.leadTime.p85 < 24
      ? "Elite: P85 < 1 day"
      : metrics.leadTime.p85 < 168
        ? "High: P85 < 1 week"
        : "Needs improvement: P85 > 1 week",
    changeFailureRate: metrics.changeFailureRate < 0.05
      ? "Elite: <5%"
      : metrics.changeFailureRate < 0.15
        ? "High: <15%"
        : "Needs improvement: >15%",
    mttr: metrics.mttr < 1
      ? "Elite: <1 hour"
      : metrics.mttr < 24
        ? "High: <1 day"
        : "Needs improvement: >1 day",
  };
  return {
    ok: project !== null,
    mode: "dora_metrics",
    ...(project ? {} : { error: "No project initialized" }),
    metrics,
    interpretation,
  };
}

/** Response shape for `metrics({mode: "tool_usage"})` — V11 Maestro Phase 1 deprecation-gate evidence. */
export interface ToolUsageResponse {
  ok: boolean;
  mode: "tool_usage";
  error?: string;
  sinceDays: number | null;
  totalDistinctTools: number;
  toolUsage: UsageStats[];
}

/**
 * Build the tool_usage response (V11 Maestro Phase 1).
 * Pure function — no side effects beyond reading from the store. Tested in isolation.
 */
export function buildToolUsageResponse(store: SqliteStore, sinceDays?: number): ToolUsageResponse {
  const project = store.getProject();
  if (!project) {
    return {
      ok: false,
      mode: "tool_usage",
      error: "No project initialized",
      sinceDays: sinceDays ?? null,
      totalDistinctTools: 0,
      toolUsage: [],
    };
  }
  const tokenStore = new ToolTokenStore(store.getDb());
  const toolUsage = tokenStore.getUsageStats(project.id, sinceDays);
  return {
    ok: true,
    mode: "tool_usage",
    sinceDays: sinceDays ?? null,
    totalDistinctTools: toolUsage.length,
    toolUsage,
  };
}

/** registerMetrics — auto-generated description placeholder. */
export function registerMetrics(server: McpServer, store: SqliteStore): void {
  server.tool(
    "metrics",
    "Show project metrics. Mode 'stats' returns aggregate graph statistics; mode 'velocity' returns sprint velocity metrics; mode 'cost' returns per-tool token cost breakdown with budget alerts; mode 'tool_usage' returns per-tool call telemetry for the deprecation gate (V11 Maestro).",
    {
      mode: z.enum(["stats", "velocity", "cost", "tool_usage", "dora_metrics"]).describe("Metrics mode: 'stats' for graph statistics, 'velocity' for sprint velocity, 'cost' for token cost breakdown, 'tool_usage' for per-tool call telemetry (V11 Maestro deprecation gate), 'dora_metrics' for DORA delivery metrics (V11 Maestro — replaces forecast(mode='dora'))"),
      sprint: z.string().optional().describe("Filter velocity results to a specific sprint (only used in velocity mode)"),
      sinceDays: z.number().int().positive().optional().describe("Window for tool_usage mode (count calls in the last N days). Default: all time."),
    },
    async ({ mode, sprint, sinceDays }) => {
      log.debug("tool:metrics", { mode, sprint, sinceDays });

      if (mode === "dora_metrics") {
        const resValue = buildDoraMetricsResponse(store);
        log.info("tool:metrics:dora_metrics:ok", {
          deployFreq: resValue.metrics.deploymentFrequency,
        });
        return mcpText(resValue);
      }

      if (mode === "tool_usage") {
        const resValue = buildToolUsageResponse(store, sinceDays);
        log.info("tool:metrics:tool_usage:ok", {
          totalDistinctTools: resValue.totalDistinctTools,
          sinceDays: resValue.sinceDays,
        });
        return mcpText(resValue);
      }

      if (mode === "cost") {
        const project = store.getProject();
        if (!project) {
          return mcpText({ ok: false, error: "No project initialized" });
        }
        const tokenStore = new ToolTokenStore(store.getDb());
        const summary = tokenStore.getSummary(project.id);

        // Calculate costs per tool using default model (configurable via project_settings)
        const defaultModel = store.getProjectSetting("cost_model_default") ?? "claude-sonnet-4";
        const perToolCosts = summary.perTool.map((t) => {
          const cost = calculateCost(defaultModel, t.totalInputTokens, t.totalOutputTokens);
          return { ...t, estimatedCostUsd: cost.totalUsd, model: defaultModel };
        });
        const totalCost = calculateCost(defaultModel, summary.totalInputTokens, summary.totalOutputTokens);

        // Check budget
        const budgetStr = store.getProjectSetting("cost_budget_usd");
        const budget = budgetStr ? parseFloat(budgetStr) : null;
        const budgetExceeded = budget !== null && totalCost.totalUsd > budget;

        log.info("tool:metrics:cost:ok", { totalCost: totalCost.totalUsd, budget });
        return mcpText({
          ok: true,
          mode: "cost",
          model: defaultModel,
          totalCalls: summary.totalCalls,
          totalInputTokens: summary.totalInputTokens,
          totalOutputTokens: summary.totalOutputTokens,
          estimatedTotalCostUsd: totalCost.totalUsd,
          budget: budget ?? "not set",
          budgetExceeded,
          perTool: perToolCosts,
        });
      }

      if (mode === "velocity") {
        const doc = store.toGraphDocument();
        const summary = calculateVelocity(doc);

        if (sprint) {
          const filtered = summary.sprints.filter((s) => s.sprint === sprint);
          // Bug #039: warn when sprint filter finds nothing instead of returning global stats
          if (filtered.length === 0) {
            log.info("tool:metrics:velocity:ok", { sprintCount: 0, sprintFilter: sprint });
            return mcpText({
              ok: true,
              mode: "velocity",
              warning: `No sprint matching '${sprint}' found`,
              sprintFilter: sprint,
              sprints: [],
              overall: summary.overall,
            });
          }
          summary.sprints = filtered;
        }

        log.info("tool:metrics:velocity:ok", { sprintCount: summary.sprints.length });
        return mcpText({ ok: true, mode: "velocity", ...summary });
      }

      // mode === "stats"
      const stats = store.getStats();
      const project = store.getProject();

      let contextEnrichment: { avgOverheadPercent: number; sampleSize: number } | null = null;
      // Backward compat alias
      let contextReduction: { avgReductionPercent: number; sampleSize: number } | null = null;

      if (stats.totalNodes > 0) {
        const allNodes = store.getAllNodes();
        const taskNodes = allNodes.filter(
          (n) => n.type === "task" || n.type === "subtask",
        );

        if (taskNodes.length > 0) {
          let totalReduction = 0;
          let sampled = 0;
          // Bug #066: sample max 50 nodes instead of ALL tasks for performance
          const sampleNodes = taskNodes.slice(0, 50);

          for (const node of sampleNodes) {
            const ctx = buildTaskContext(store, node.id);
            if (ctx) {
              totalReduction += ctx.metrics.reductionPercent;
              sampled++;
            }
          }

          if (sampled > 0) {
            const avgReduction = Math.round(totalReduction / sampled);
            // Bug #BF6: reductionPercent is always negative because context() enriches
            // (adds metadata) rather than compresses. Expose as positive overhead.
            contextEnrichment = {
              avgOverheadPercent: Math.abs(avgReduction),
              sampleSize: sampled,
            };
            // Backward compat: keep old field with original (negative) value
            contextReduction = {
              avgReductionPercent: avgReduction,
              sampleSize: sampled,
            };
          }
        }
      }

      // Bug #067: add sprint count, phase, knowledge count
      // Bug #038: read phase override from project_settings (same pattern as lifecycle-wrapper)
      const doc = store.toGraphDocument();
      const phaseOverrideValue = store.getProjectSetting("lifecycle_phase_override");
      const currentPhase = detectCurrentPhase(doc, {
        phaseOverride: phaseOverrideValue ? phaseOverrideValue as LifecyclePhase : null,
      });
      const velocity = calculateVelocity(doc);
      let knowledgeDocCount = 0;
      try {
        const ks = new KnowledgeStore(store.getDb());
        knowledgeDocCount = ks.list({}).length;
      } catch { /* knowledge store may not exist */ }

      // Harness score (non-blocking, cached)
      let harnessScore: { score: number; grade: string } | null = null;
      try {
        const harness = runHarnessScanCached(process.cwd());
        if (harness) harnessScore = { score: harness.score, grade: harness.grade };
      } catch { /* non-blocking */ }

      // Recovery metrics (MTTR-A — Phase D Autonomous Loop)
      let recoveryMetrics: { totalRollbacks: number; totalEscalations: number; avgMttrMs: number; successRate: number } | null = null;
      try {
        const recoveryStore = new RecoveryMetricsStore(store.getDb());
        const summary = recoveryStore.getSummary();
        if (summary.totalRollbacks > 0 || summary.totalEscalations > 0) {
          recoveryMetrics = {
            totalRollbacks: summary.totalRollbacks,
            totalEscalations: summary.totalEscalations,
            avgMttrMs: summary.avgMttrMs,
            successRate: summary.successRate,
          };
        }
      } catch { /* recovery_metrics table may not exist */ }

      log.info("tool:metrics:stats:ok", { totalNodes: stats.totalNodes, totalEdges: stats.totalEdges });
      return mcpText({
        ok: true,
        mode: "stats",
        project: project?.name ?? null,
        ...stats,
        currentPhase,
        sprintCount: velocity.sprints.length,
        knowledgeDocCount,
        contextEnrichment,
        contextReduction,
        harnessScore,
        ...(recoveryMetrics ? { recoveryMetrics } : {}),
      });
    },
  );
}
