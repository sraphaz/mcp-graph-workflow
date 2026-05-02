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
import { analyzePrdQuality } from "../../core/analyzer/prd-quality.js";
import { analyzeScope } from "../../core/analyzer/scope-analyzer.js";
import { checkDefinitionOfReady } from "../../core/analyzer/definition-of-ready.js";
import { assessRisks } from "../../core/analyzer/risk-assessment.js";
import {
  findTransitiveBlockers,
  detectCycles,
  findCriticalPath,
} from "../../core/planner/dependency-chain.js";
import { detectLargeTasks } from "../../core/planner/decompose.js";
import { validateAdrs } from "../../core/designer/adr-validator.js";
import { buildTraceabilityMatrix } from "../../core/designer/traceability-matrix.js";
import { analyzeCoupling } from "../../core/designer/coupling-analyzer.js";
import { checkInterfaces } from "../../core/designer/interface-checker.js";
import { assessTechRisks } from "../../core/designer/tech-risk-assessor.js";
import { checkDesignReadiness } from "../../core/designer/definition-of-ready.js";
import { runAdrChallenge, runAllAdrChallenges } from "../../core/designer/adr-challenge-runner.js";
import { serializeChallengeReport } from "../../core/designer/challenge-report.js";
import { checkValidationReadiness } from "../../core/validator/definition-of-ready.js";
import { checkDoneIntegrity } from "../../core/validator/done-integrity-checker.js";
import { checkStatusFlow } from "../../core/validator/status-flow-checker.js";
import { checkReviewReadiness } from "../../core/reviewer/review-readiness.js";
import { checkHandoffReadiness } from "../../core/handoff/delivery-checklist.js";
import { checkDocCompleteness } from "../../core/handoff/doc-completeness.js";
import { checkDeployReadiness } from "../../core/deployer/deploy-readiness.js";
import { checkListeningReadiness } from "../../core/listener/feedback-readiness.js";
import { checkApproval } from "../../core/approval/approval-checker.js";
import { analyzeBacklogHealth } from "../../core/listener/backlog-health.js";
import { analyzeSprintHealth } from "../../core/planner/sprint-health.js";
import { analyzeAutoReady } from "../../core/planner/auto-ready.js";
import { analyzeContractCoverage } from "../../core/analyzer/contract-coverage.js";
import { analyzeDataIntegrity } from "../../core/analyzer/data-integrity.js";
import { analyzeFormulaConsistency } from "../../core/analyzer/formula-consistency.js";
import { analyzePerformanceBudgets } from "../../core/analyzer/performance-budget-check.js";
import { analyzeStateCompleteness } from "../../core/analyzer/state-completeness.js";
import { analyzeScenarioCoverage } from "../../core/analyzer/scenario-coverage.js";
import { analyzeAssetBlockers } from "../../core/analyzer/asset-blockers.js";
import { analyzeConfigCoverage } from "../../core/analyzer/config-coverage.js";
import { analyzeMetricCoverage } from "../../core/analyzer/metric-coverage.js";
import { analyzeConcurrencyRisk } from "../../core/analyzer/concurrency-risk.js";
import { simulateEconomy } from "../../core/analyzer/economy-simulator.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { detectCurrentPhase } from "../../core/planner/lifecycle-phase.js";
import { checkDefinitionOfDone } from "../../core/implementer/definition-of-done.js";
import { checkTddAdherence } from "../../core/implementer/tdd-checker.js";
import { calculateSprintProgress } from "../../core/implementer/sprint-progress.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";
import { buildMemoryHealthReport } from "../../core/utils/memory-telemetry.js";
import { wrapDesignPhaseAdvisory } from "../../core/analyzer/out-of-phase-advisory.js";
import { validateFilesCitations } from "../../core/citations/citation-validator.js";

const ANALYZE_MODES = z.enum([
  "prd_quality",
  "scope",
  "ready",
  "risk",
  "blockers",
  "cycles",
  "critical_path",
  "contract_coverage",
  "data_integrity",
  "decompose",
  "adr",
  "formula_consistency",
  "traceability",
  "coupling",
  "interfaces",
  "tech_risk",
  "design_ready",
  "implement_done",
  "tdd_check",
  "performance_budget",
  "progress",
  "state_completeness",
  "validate_ready",
  "done_integrity",
  "status_flow",
  "review_ready",
  "handoff_ready",
  "doc_completeness",
  "deploy_ready",
  "release_check",
  "listening_ready",
  "backlog_health",
  "sprint_health",
  "auto_ready",
  "scenario_coverage",
  "asset_blockers",
  "config_coverage",
  "metric_coverage",
  "concurrency_risk",
  "economy_simulation",
  "cfd",
  "code_sync",
  "smart_decompose",
  "security_scan",
  "code_quality",
  "test_coverage",
  "observability_check",
  "harness_scan",
  "harness_trend",
  "harness_advice",
  "harness_remediate",
  "adr_challenge",
  "orphan_tasks",
  "memory_health",
  "citation_groundedness",
  "approval_check",
  "prd_lifecycle_health",
  "capacity_health",
  "success_rate",
  "evolution_audit",
  "feature_depth",
  "harness_savings",
]);

function hasNode(doc: { nodes: Array<{ id: string }> }, nodeId: string): boolean {
  return doc.nodes.some((node) => node.id === nodeId);
}

export function registerAnalyze(server: McpServer, store: SqliteStore): void {
  server.tool(
    "analyze",
    "Analyze the project graph. Modes: prd_quality, scope, ready, risk, blockers, cycles, critical_path, contract_coverage, data_integrity, decompose, adr, formula_consistency, traceability, coupling, interfaces, tech_risk, design_ready (DESIGN→PLAN gate), implement_done, tdd_check, performance_budget, progress, state_completeness, validate_ready (IMPLEMENT→VALIDATE gate), done_integrity, status_flow, review_ready (VALIDATE→REVIEW gate), handoff_ready (REVIEW→HANDOFF gate), doc_completeness, deploy_ready (HANDOFF→DEPLOY gate), release_check, listening_ready (DEPLOY→LISTENING gate), backlog_health, sprint_health (sprint metrics + health grade), auto_ready (identify backlog tasks promotable to ready), scenario_coverage, asset_blockers, config_coverage, metric_coverage, concurrency_risk, economy_simulation (gold inflow vs outflow inflation detector — pass JSON params via nodeId: {playerCount, avgSessionHours, avgLevel}), harness_scan (compute Harnessability Score across 4 dimensions: type coverage, test coverage, docs coverage, architecture fitness — returns score, grade A–D, breakdown, details, timestamp), harness_trend (show harness score evolution — returns last 10 snapshots with trend direction: improving/degrading/stable/no_data and delta), harness_advice (per-dimension remediation — returns file-level improvement suggestions for dimensions scoring < 70), prd_lifecycle_health (9-phase régua per epic — passedAll boolean + summary; nodeId required), capacity_health (PLAN-phase calibration delta vs velocity ±10% tolerance — sprintLabel via nodeId), success_rate (rolling pass-rate over the most recent N lifecycle_health snapshots — `window` param, default 10; nodeId scopes to a specific epic).",
    {
      mode: ANALYZE_MODES.describe("Analysis mode"),
      nodeId: z.string().optional().describe("Node ID (required for 'blockers'/'implement_done', optional for 'decompose'/'tdd_check'. For 'progress' mode, used as sprint name filter)"),
      window: z.number().int().positive().optional().describe("Window size for 'success_rate' mode — defaults to 10."),
    },
    async ({ mode, nodeId, window }) => {
      logger.debug("tool:analyze", { mode, nodeId });
      const doc = store.toGraphDocument();

      switch (mode) {
        case "prd_quality": {
          const report = analyzePrdQuality(doc);
          logger.info("tool:analyze:prd_quality:ok", { score: report.score, grade: report.grade });
          return mcpText({ ok: true, mode, ...report });
        }

        case "scope": {
          const analysis = analyzeScope(doc);
          logger.info("tool:analyze:scope:ok", { orphans: analysis.orphans.length });
          return mcpText({ ok: true, mode, ...analysis });
        }

        case "ready": {
          const readiness = checkDefinitionOfReady(doc);
          logger.info("tool:analyze:ready:ok", { ready: readiness.readyForNextPhase });
          return mcpText({ ok: true, mode, ...readiness });
        }

        case "risk": {
          const matrix = assessRisks(doc);
          logger.info("tool:analyze:risk:ok", { total: matrix.summary.total });
          return mcpText({ ok: true, mode, ...matrix });
        }

        case "blockers": {
          if (!nodeId) {
            return mcpError("nodeId is required for 'blockers' mode");
          }
          // Bug #025: validate node exists
          if (!doc.nodes.find((n) => n.id === nodeId)) {
            return mcpError(`Node not found: ${nodeId}`);
          }
          const blockers = findTransitiveBlockers(doc, nodeId);
          logger.info("tool:analyze:blockers:ok", { nodeId, blockerCount: blockers.length });
          return mcpText({ ok: true, mode, nodeId, blockers });
        }

        case "cycles": {
          const cycles = detectCycles(doc);
          logger.info("tool:analyze:cycles:ok", { cycleCount: cycles.length });
          return mcpText({ ok: true, mode, cycles });
        }

        case "critical_path": {
          const path = findCriticalPath(doc);
          logger.info("tool:analyze:critical_path:ok", { pathLength: path.length });
          return mcpText({ ok: true, mode, criticalPath: path });
        }

        case "decompose": {
          let results = detectLargeTasks(doc);
          if (nodeId) {
            results = results.filter((r) => r.node.id === nodeId);
          }
          logger.info("tool:analyze:decompose:ok", { count: results.length });
          return mcpText({ ok: true, mode, results });
        }

        case "adr": {
          const phase = detectCurrentPhase(doc);
          const adrReport = validateAdrs(doc);
          logger.info("tool:analyze:adr:ok", { grade: adrReport.overallGrade });
          const response: Record<string, unknown> = { ok: true, mode, ...adrReport };
          if (phase !== "DESIGN") response._info = `Modo adr é específico da fase DESIGN (fase atual: ${phase})`;
          return mcpText(response);
        }

        case "traceability": {
          const phase = detectCurrentPhase(doc);
          const traceReport = buildTraceabilityMatrix(doc);
          logger.info("tool:analyze:traceability:ok", { coverageRate: traceReport.coverageRate });
          return mcpText(wrapDesignPhaseAdvisory(phase, mode, traceReport as unknown as Record<string, unknown>));
        }

        case "coupling": {
          const phase = detectCurrentPhase(doc);
          const couplingReport = analyzeCoupling(doc);
          logger.info("tool:analyze:coupling:ok", { highCoupling: couplingReport.highCouplingNodes.length });
          return mcpText(wrapDesignPhaseAdvisory(phase, mode, couplingReport as unknown as Record<string, unknown>));
        }

        case "interfaces": {
          const phase = detectCurrentPhase(doc);
          const ifReport = checkInterfaces(doc);
          logger.info("tool:analyze:interfaces:ok", { overallScore: ifReport.overallScore });
          return mcpText(wrapDesignPhaseAdvisory(phase, mode, ifReport as unknown as Record<string, unknown>));
        }

        case "tech_risk": {
          const phase = detectCurrentPhase(doc);
          const techRiskReport = assessTechRisks(doc);
          logger.info("tool:analyze:tech_risk:ok", { riskScore: techRiskReport.riskScore });
          return mcpText(wrapDesignPhaseAdvisory(phase, mode, techRiskReport as unknown as Record<string, unknown>));
        }

        case "design_ready": {
          const phase = detectCurrentPhase(doc);
          const readinessReport = checkDesignReadiness(doc);
          logger.info("tool:analyze:design_ready:ok", { ready: readinessReport.ready, grade: readinessReport.grade });
          return mcpText(wrapDesignPhaseAdvisory(phase, mode, readinessReport as unknown as Record<string, unknown>));
        }

        case "implement_done": {
          if (!nodeId) {
            return mcpError("nodeId is required for 'implement_done' mode");
          }
          // Bug #026: validate node exists
          if (!doc.nodes.find((n) => n.id === nodeId)) {
            return mcpError(`Node not found: ${nodeId}`);
          }
          const phase = detectCurrentPhase(doc);
          const dodReport = checkDefinitionOfDone(doc, nodeId);
          logger.info("tool:analyze:implement_done:ok", { nodeId, ready: dodReport.ready, grade: dodReport.grade });
          const dodResponse: Record<string, unknown> = { ok: true, mode, ...dodReport };
          if (phase !== "IMPLEMENT") dodResponse._info = `Modo implement_done é específico da fase IMPLEMENT (fase atual: ${phase})`;
          return mcpText(dodResponse);
        }

        case "tdd_check": {
          if (nodeId && !hasNode(doc, nodeId)) {
            return mcpError(`Node not found: ${nodeId}`);
          }
          const phase = detectCurrentPhase(doc);
          const tddReport = checkTddAdherence(doc, nodeId);
          logger.info("tool:analyze:tdd_check:ok", { tasks: tddReport.tasks.length, overallTestability: tddReport.overallTestability });
          const tddResponse: Record<string, unknown> = { ok: true, mode, ...tddReport };
          if (phase !== "IMPLEMENT") tddResponse._info = `Modo tdd_check é específico da fase IMPLEMENT (fase atual: ${phase})`;
          return mcpText(tddResponse);
        }

        case "progress": {
          const phase = detectCurrentPhase(doc);
          const progressReport = calculateSprintProgress(doc, nodeId);
          logger.info("tool:analyze:progress:ok", { done: progressReport.burndown.done, total: progressReport.burndown.total });
          const progressResponse: Record<string, unknown> = { ok: true, mode, ...progressReport };
          if (phase !== "IMPLEMENT") progressResponse._info = `Modo progress é específico da fase IMPLEMENT (fase atual: ${phase})`;
          return mcpText(progressResponse);
        }

        case "validate_ready": {
          const phase = detectCurrentPhase(doc);
          const valReport = checkValidationReadiness(doc);
          logger.info("tool:analyze:validate_ready:ok", { ready: valReport.ready, grade: valReport.grade });
          const valResponse: Record<string, unknown> = { ok: true, mode, ...valReport };
          if (phase !== "VALIDATE" && phase !== "IMPLEMENT") valResponse._info = `Modo validate_ready é específico das fases IMPLEMENT/VALIDATE (fase atual: ${phase})`;
          return mcpText(valResponse);
        }

        case "done_integrity": {
          const doneReport = checkDoneIntegrity(doc);
          logger.info("tool:analyze:done_integrity:ok", { passed: doneReport.passed, issues: doneReport.issues.length });
          return mcpText({ ok: true, mode, ...doneReport });
        }

        case "status_flow": {
          const flowReport = checkStatusFlow(doc);
          logger.info("tool:analyze:status_flow:ok", { complianceRate: flowReport.complianceRate });
          return mcpText({ ok: true, mode, ...flowReport });
        }

        case "review_ready": {
          const phase = detectCurrentPhase(doc);
          const revReport = checkReviewReadiness(doc);
          logger.info("tool:analyze:review_ready:ok", { ready: revReport.ready, grade: revReport.grade });
          const revResponse: Record<string, unknown> = { ok: true, mode, ...revReport };
          if (phase !== "REVIEW" && phase !== "VALIDATE") revResponse._info = `Modo review_ready é específico das fases VALIDATE/REVIEW (fase atual: ${phase})`;
          return mcpText(revResponse);
        }

        case "handoff_ready": {
          const phase = detectCurrentPhase(doc);
          const ks = new KnowledgeStore(store.getDb());
          const knowledgeCount = ks.count();
          const hoReport = checkHandoffReadiness(doc, { knowledgeCount });
          logger.info("tool:analyze:handoff_ready:ok", { ready: hoReport.ready, grade: hoReport.grade });
          const hoResponse: Record<string, unknown> = { ok: true, mode, ...hoReport };
          if (phase !== "HANDOFF" && phase !== "REVIEW") hoResponse._info = `Modo handoff_ready é específico das fases REVIEW/HANDOFF (fase atual: ${phase})`;
          return mcpText(hoResponse);
        }

        case "doc_completeness": {
          const docReport = checkDocCompleteness(doc);
          logger.info("tool:analyze:doc_completeness:ok", { coverageRate: docReport.coverageRate });
          return mcpText({ ok: true, mode, ...docReport });
        }

        case "deploy_ready": {
          const phase = detectCurrentPhase(doc);
          const snapshots = store.listSnapshots();
          const hasSnapshots = snapshots.length > 0;
          const ksD = new KnowledgeStore(store.getDb());
          const knowledgeCountD = ksD.count();
          const deployReport = checkDeployReadiness(doc, { hasSnapshots, knowledgeCount: knowledgeCountD });
          logger.info("tool:analyze:deploy_ready:ok", { ready: deployReport.ready, grade: deployReport.grade });
          const deployResponse: Record<string, unknown> = { ok: true, mode, ...deployReport };
          if (phase !== "DEPLOY" && phase !== "HANDOFF") deployResponse._info = `Modo deploy_ready é específico das fases HANDOFF/DEPLOY (fase atual: ${phase})`;
          return mcpText(deployResponse);
        }

        case "release_check": {
          const phase = detectCurrentPhase(doc);
          const snapshots = store.listSnapshots();
          const hasSnapshots = snapshots.length > 0;
          const tasks = doc.nodes.filter((n) => n.type === "task" || n.type === "subtask");
          const doneTasks = tasks.filter((n) => n.status === "done");
          const allDone = tasks.length > 0 && tasks.every((n) => n.status === "done");
          const blockedCount = doc.nodes.filter((n) => n.status === "blocked").length;
          const inProgressCount = tasks.filter((n) => n.status === "in_progress").length;

          const releaseChecks = {
            all_tasks_done: allDone,
            no_blocked_nodes: blockedCount === 0,
            no_in_progress: inProgressCount === 0,
            snapshot_exists: hasSnapshots,
            task_summary: `${doneTasks.length}/${tasks.length} tasks done`,
          };
          const releaseReady = allDone && blockedCount === 0 && inProgressCount === 0 && hasSnapshots;
          logger.info("tool:analyze:release_check:ok", { releaseReady });
          const releaseResponse: Record<string, unknown> = { ok: true, mode, releaseReady, checks: releaseChecks };
          if (phase !== "DEPLOY") releaseResponse._info = `Modo release_check é específico da fase DEPLOY (fase atual: ${phase})`;
          return mcpText(releaseResponse);
        }

        case "listening_ready": {
          const phase = detectCurrentPhase(doc);
          const snapshots = store.listSnapshots();
          const hasSnapshots = snapshots.length > 0;
          const ksL = new KnowledgeStore(store.getDb());
          const knowledgeCountL = ksL.count();
          const lisReport = checkListeningReadiness(doc, { hasSnapshots, knowledgeCount: knowledgeCountL });
          logger.info("tool:analyze:listening_ready:ok", { ready: lisReport.ready, grade: lisReport.grade });
          const lisResponse: Record<string, unknown> = { ok: true, mode, ...lisReport };
          if (phase !== "LISTENING" && phase !== "HANDOFF") lisResponse._info = `Modo listening_ready é específico das fases HANDOFF/LISTENING (fase atual: ${phase})`;
          return mcpText(lisResponse);
        }

        case "backlog_health": {
          const healthReport = analyzeBacklogHealth(doc);
          logger.info("tool:analyze:backlog_health:ok", { clean: healthReport.cleanForNewCycle, stale: healthReport.staleTasks.length });
          return mcpText({ ok: true, mode, ...healthReport });
        }

        case "sprint_health": {
          const sprintHealthReport = analyzeSprintHealth(doc, nodeId);
          logger.info("tool:analyze:sprint_health:ok", { health: sprintHealthReport.health, tasks: sprintHealthReport.metrics.taskCount });
          return mcpText({ ok: true, mode, ...sprintHealthReport });
        }

        case "auto_ready": {
          const readyReport = analyzeAutoReady(doc);
          return mcpText({ ok: true, mode: "auto_ready", ...readyReport });
        }

        case "contract_coverage": {
          const ccReport = analyzeContractCoverage(doc);
          logger.info("tool:analyze:contract_coverage:ok", { totalContracts: ccReport.totalContracts, coveragePercent: ccReport.coveragePercent });
          return mcpText({ ok: true, mode, ...ccReport });
        }

        case "data_integrity": {
          const diReport = analyzeDataIntegrity(doc);
          logger.info("tool:analyze:data_integrity:ok", { totalTables: diReport.totalTables, validCount: diReport.validCount });
          return mcpText({ ok: true, mode, ...diReport });
        }

        case "formula_consistency": {
          const fcReport = analyzeFormulaConsistency(doc);
          logger.info("tool:analyze:formula_consistency:ok", { totalFormulas: fcReport.totalFormulas, validCount: fcReport.validCount, conflicts: fcReport.conflicts.length });
          return mcpText({ ok: true, mode, ...fcReport });
        }

        case "performance_budget": {
          const pbReport = analyzePerformanceBudgets(doc);
          logger.info("tool:analyze:performance_budget:ok", { totalBudgets: pbReport.totalBudgets, untestedCount: pbReport.untestedCount });
          return mcpText({ ok: true, mode, ...pbReport });
        }

        case "state_completeness": {
          const scReport = analyzeStateCompleteness(doc);
          logger.info("tool:analyze:state_completeness:ok", { totalMachines: scReport.totalMachines, validCount: scReport.validCount });
          return mcpText({ ok: true, mode, ...scReport });
        }

        case "scenario_coverage": {
          const scenReport = analyzeScenarioCoverage(doc);
          logger.info("tool:analyze:scenario_coverage:ok", { totalScenarios: scenReport.totalScenarios, coveragePercent: scenReport.coveragePercent });
          return mcpText({ ok: true, mode, ...scenReport });
        }

        case "asset_blockers": {
          const abReport = analyzeAssetBlockers(doc);
          logger.info("tool:analyze:asset_blockers:ok", { pendingAssets: abReport.pendingAssets, blockedTaskCount: abReport.blockedTaskCount });
          return mcpText({ ok: true, mode, ...abReport });
        }

        case "config_coverage": {
          const ccfReport = analyzeConfigCoverage(doc);
          logger.info("tool:analyze:config_coverage:ok", { totalConfigs: ccfReport.totalConfigs, coveragePercent: ccfReport.coveragePercent });
          return mcpText({ ok: true, mode, ...ccfReport });
        }

        case "metric_coverage": {
          const mcReport = analyzeMetricCoverage(doc);
          logger.info("tool:analyze:metric_coverage:ok", { totalMetrics: mcReport.totalMetrics, coveragePercent: mcReport.coveragePercent });
          return mcpText({ ok: true, mode, ...mcReport });
        }

        case "concurrency_risk": {
          const crReport = analyzeConcurrencyRisk(doc);
          logger.info("tool:analyze:concurrency_risk:ok", { totalRisks: crReport.totalRisks, entityConflicts: crReport.entityConflicts.length });
          return mcpText({ ok: true, mode, ...crReport });
        }

        case "economy_simulation": {
          let simParams = { playerCount: 1000, avgSessionHours: 3, avgLevel: 30 };
          if (nodeId) {
            try {
              simParams = { ...simParams, ...JSON.parse(nodeId) };
            } catch {
              /* use defaults when nodeId is not valid JSON */
            }
          }
          const simReport = simulateEconomy(doc, simParams);
          logger.info("tool:analyze:economy_simulation:ok", { risk: simReport.inflationRisk, net: simReport.netFlowPerDay });
          return mcpText({ ok: true, mode: "economy_simulation", ...simReport });
        }

        case "smart_decompose": {
          if (!nodeId) return mcpError("smart_decompose requires a nodeId");
          if (!hasNode(doc, nodeId)) {
            return mcpError(`Node not found: ${nodeId}`);
          }
          const { smartDecompose } = await import("../../core/planner/smart-decompose.js");
          const decomposeResult = smartDecompose(store, nodeId);
          if (!decomposeResult) return mcpText({ ok: false, mode: "smart_decompose", message: "Node has no acceptance criteria" });
          logger.info("tool:analyze:smart_decompose:ok", { subtasks: decomposeResult.subtasks.length });
          return mcpText({ ok: true, mode: "smart_decompose", ...decomposeResult });
        }

        case "code_sync": {
          const { syncGraphFromCode } = await import("../../core/code/graph-sync.js");
          const syncReport = syncGraphFromCode(store);
          logger.info("tool:analyze:code_sync:ok", { staleRefs: syncReport.staleRefs.length, suggestions: syncReport.suggestions.length });
          return mcpText({ ok: true, mode: "code_sync", ...syncReport });
        }

        case "cfd": {
          const { captureFlowSnapshot, getCfdData } = await import("../../core/insights/flow-tracker.js");
          const project = store.getProject();
          if (!project) return mcpError("No active project");
          captureFlowSnapshot(store, project.id);
          const cfdData = getCfdData(store, project.id);
          logger.info("tool:analyze:cfd:ok", { dataPoints: cfdData.length });
          return mcpText({ ok: true, mode: "cfd", dataPoints: cfdData.length, data: cfdData });
        }

        case "security_scan": {
          const { checkSecurityScan } = await import("../../core/analyzer/security-scanner.js");
          const report = checkSecurityScan(process.cwd());
          logger.info("tool:analyze:security_scan:ok", { score: report.score, grade: report.grade });
          return mcpText({ ok: true, ...report });
        }

        case "code_quality": {
          const { checkCodeQuality } = await import("../../core/analyzer/code-quality-checker.js");
          const report = checkCodeQuality(process.cwd());
          logger.info("tool:analyze:code_quality:ok", { score: report.score, grade: report.grade });
          return mcpText({ ok: true, ...report });
        }

        case "test_coverage": {
          const { checkTestCoverage } = await import("../../core/analyzer/test-coverage-checker.js");
          const report = checkTestCoverage(process.cwd());
          logger.info("tool:analyze:test_coverage:ok", { score: report.score, grade: report.grade });
          return mcpText({ ok: true, ...report });
        }

        case "observability_check": {
          const { checkObservability } = await import("../../core/analyzer/observability-checker.js");
          const report = checkObservability(process.cwd());
          logger.info("tool:analyze:observability_check:ok", { score: report.score, grade: report.grade });
          return mcpText({ ok: true, ...report });
        }

        case "harness_scan": {
          const { runHarnessScan } = await import("../../core/harness/harness-scan-runner.js");
          const activeProject = store.getActiveProject();
          const report = runHarnessScan(process.cwd(), store.getDb(), undefined, {
            projectId: activeProject?.id,
          });
          logger.info("tool:analyze:harness_scan:ok", { score: report.score, grade: report.grade });

          // Index scan result in KnowledgeStore for RAG retrieval (non-blocking)
          try {
            const ksHarness = new KnowledgeStore(store.getDb());
            ksHarness.insert({
              title: `Harness Scan — Grade ${report.grade} (${report.score}/100)`,
              content: `Harnessability Score: ${report.score}/100 (Grade ${report.grade}). ${report.details.join(". ")}`,
              sourceType: "harness_scan",
              sourceId: `harness_scan_${report.timestamp}`,
              metadata: { score: report.score, grade: report.grade, timestamp: report.timestamp },
            });
          } catch {
            // non-blocking
          }

          return mcpText({ ok: true, mode, ...report });
        }

        case "harness_trend": {
          const db = store.getDb();
          const project = store.getActiveProject();
          const projectId = project?.id ?? "default";

          const rows = db
            .prepare(
              "SELECT score, grade, breakdown, git_commit, timestamp FROM harness_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT 10",
            )
            .all(projectId) as Array<{
              score: number;
              grade: string;
              breakdown: string;
              git_commit: string | null;
              timestamp: string;
            }>;

          // Reverse to ASC order for presentation
          const history = rows.reverse().map((r) => ({
            score: r.score,
            grade: r.grade,
            timestamp: r.timestamp,
            gitCommit: r.git_commit,
          }));

          if (history.length === 0) {
            logger.info("tool:analyze:harness_trend:no_data");
            return mcpText({ ok: true, mode, history: [], trend: "no_data", delta: 0 });
          }

          const first = history[0].score;
          const last = history[history.length - 1].score;
          const delta = Math.round((last - first) * 10) / 10;
          const absDelta = Math.abs(delta);

          let trend: "improving" | "degrading" | "stable" | "no_data";
          if (absDelta < 2) {
            trend = "stable";
          } else if (delta > 0) {
            trend = "improving";
          } else {
            trend = "degrading";
          }

          logger.info("tool:analyze:harness_trend:ok", { entries: history.length, trend, delta });
          return mcpText({ ok: true, mode, history, trend, delta });
        }

        case "harness_remediate": {
          const { runHarnessScan: remScan } = await import("../../core/harness/harness-scan-runner.js");
          const { evaluate: evalRemediation } = await import("../../core/harness/remediation-engine.js");
          const remReport = remScan(process.cwd(), store.getDb(), undefined, { collectViolations: true });
          const suggestions = evalRemediation(remReport.violations ?? [], store.getDb());
          logger.info("tool:analyze:harness_remediate:ok", { score: remReport.score, suggestions: suggestions.length });
          return mcpText({
            ok: true,
            mode,
            score: remReport.score,
            grade: remReport.grade,
            suggestions: suggestions.map((s) => ({
              ruleId: s.ruleId,
              file: s.violation.file,
              line: s.violation.line,
              dimension: s.violation.dimension,
              violationType: s.violation.violationType,
              suggestedFix: s.suggestedFix,
              confidence: s.confidence,
              category: s.category,
              priority: s.priority,
            })),
            totalViolations: remReport.violations?.length ?? 0,
            message: suggestions.length === 0
              ? "No actionable remediations — all dimensions healthy or suppressed"
              : `${suggestions.length} remediation(s) found, sorted by priority`,
          });
        }

        case "harness_advice": {
          const { runHarnessScan } = await import("../../core/harness/harness-scan-runner.js");
          const { buildAdviceEntries } = await import("../../core/harness/harness-advice-generator.js");

          // Collect file-level violations so advice can reference specific files
          const adviceReport = runHarnessScan(process.cwd(), store.getDb(), undefined, { collectViolations: true });
          const violations = adviceReport.violations ?? [];
          const breakdown = adviceReport.breakdown as Record<string, { score: number; weight: number }>;

          const advice = buildAdviceEntries({
            breakdown,
            typeViolations: violations.filter((v) => v.dimension === "types"),
            testViolations: violations.filter((v) => v.dimension === "tests"),
          });

          const message = advice.length === 0 ? "Harness score healthy — all dimensions >= 70" : `${advice.length} dimension(s) need improvement`;
          logger.info("tool:analyze:harness_advice:ok", { score: adviceReport.score, dimensions: advice.length });
          return mcpText({ ok: true, mode, score: adviceReport.score, grade: adviceReport.grade, advice, message });
        }

        case "adr_challenge": {
          if (nodeId) {
            const node = doc.nodes.find((n) => n.id === nodeId);
            if (!node) {
              return mcpError(`Node not found: ${nodeId}`);
            }
            if (node.type !== "decision") {
              return mcpError(`InvalidNodeType: expected 'decision', got '${node.type}'`);
            }
            const result = runAdrChallenge(store, nodeId);
            const serialized = serializeChallengeReport(result.report, "standard");
            return mcpText({
              ok: true,
              mode,
              nodeId,
              nodeTitle: result.nodeTitle,
              verdict: result.report.overallVerdict.verdict,
              compositeScore: result.report.fitnessScore.composite,
              grade: result.report.fitnessScore.grade,
              findings: result.report.preMortemFindings.length,
              questions: result.report.challengeQuestions,
              report: serialized,
            });
          }
          const allResult = runAllAdrChallenges(store);
          return mcpText({
            ok: true,
            mode,
            summary: allResult.summary,
            reports: allResult.reports.map((r) => ({
              nodeId: r.nodeId,
              title: r.nodeTitle,
              verdict: r.report.overallVerdict.verdict,
              compositeScore: r.report.fitnessScore.composite,
              grade: r.report.fitnessScore.grade,
            })),
          });
        }

        case "orphan_tasks": {
          const { detectOrphanTasks } = await import("../../core/analyzer/orphan-task-detector.js");
          const orphans = detectOrphanTasks(store, process.cwd());
          logger.info("tool:analyze:orphan_tasks:ok", { count: orphans.length });
          return mcpText({
            ok: true,
            mode,
            orphanCandidates: orphans,
            count: orphans.length,
            hint: orphans.length > 0
              ? "Review these tasks — they may already be implemented. Use update_status to mark them done."
              : "No orphan tasks detected.",
          });
        }

        case "memory_health": {
          const agentCount = (store as unknown as { connections?: { size: number } }).connections?.size ?? 0;
          const report = buildMemoryHealthReport({ agentCount });
          logger.info("tool:analyze:memory_health:ok", { level: report.heap.level, heapUsedMb: report.heap.heapUsedMb });
          return mcpText(JSON.stringify(report, null, 2));
        }

        case "citation_groundedness": {
          if (!nodeId) {
            return mcpError("nodeId is required for 'citation_groundedness' mode");
          }
          const node = doc.nodes.find((n) => n.id === nodeId);
          if (!node) {
            return mcpError(`Node ${nodeId} not found`);
          }
          const meta = (node.metadata ?? {}) as Record<string, unknown>;
          const observed = Array.isArray(meta.touchedFilesObserved) ? (meta.touchedFilesObserved as string[]) : [];
          const declared = Array.isArray(meta.touchedFiles) ? (meta.touchedFiles as string[]) : [];
          const paths = [...new Set([...observed, ...declared])];
          const cwd = process.cwd();
          const files: { path: string; content: string }[] = [];
          for (const p of paths) {
            try {
              const full = p.startsWith("/") ? p : `${cwd}/${p}`;
              const fs = await import("node:fs");
              if (fs.existsSync(full) && fs.statSync(full).isFile()) {
                files.push({ path: p, content: fs.readFileSync(full, "utf-8") });
              }
            } catch {
              // skip unreadable files
            }
          }
          const result = validateFilesCitations(files);
          logger.info("tool:analyze:citation_groundedness:ok", {
            nodeId,
            checked: result.checkedCount,
            violations: result.violations.length,
          });
          return mcpText({
            ok: true,
            mode,
            nodeId,
            checkedCount: result.checkedCount,
            violationCount: result.violations.length,
            violations: result.violations,
          });
        }

        case "approval_check": {
          // §EPIC-15.2 — nodeId carries a JSON payload {tool, input}
          // (mirrors the economy_simulation convention).
          if (!nodeId) {
            return mcpError("approval_check requires JSON payload via nodeId field: {\"tool\":\"Bash\",\"input\":{\"command\":\"…\"}}");
          }
          let parsed: unknown;
          try {
            parsed = JSON.parse(nodeId);
          } catch {
            return mcpError("approval_check nodeId must be valid JSON");
          }
          if (typeof parsed !== "object" || parsed === null) {
            return mcpError("approval_check payload must be an object {tool, input}");
          }
          const { tool, input } = parsed as { tool?: unknown; input?: unknown };
          if (typeof tool !== "string") {
            return mcpError("approval_check payload.tool must be a string");
          }
          const result = checkApproval({
            tool,
            input: (input && typeof input === "object") ? (input as Record<string, unknown>) : null,
          });
          logger.info("tool:analyze:approval_check:ok", {
            tool,
            requires_approval: result.requires_approval,
            severity: result.severity,
            matched: result.matchedPatterns,
          });
          return mcpText({ ok: true, mode, ...result });
        }

        case "prd_lifecycle_health": {
          if (!nodeId) {
            return mcpError("nodeId is required for 'prd_lifecycle_health' mode");
          }
          const { computePrdLifecycleHealth } = await import(
            "../../core/analyzer/prd-lifecycle-health.js"
          );
          const { computeCapacityHealth } = await import(
            "../../core/analyzer/capacity-health.js"
          );
          const { sweepStaleDecisions } = await import(
            "../../core/autonomy/listening-sweep.js"
          );
          const cap = computeCapacityHealth(doc);
          const sweep = sweepStaleDecisions(store.getDb());
          const report = computePrdLifecycleHealth(doc, nodeId, {
            capacityCalibrationDelta: cap.deltaPct,
            decisionOutcomeClosureRate: sweep.closureRate,
          });
          // §SprintD — persist snapshot for analyze(success_rate) trend.
          try {
            const { recordSnapshot } = await import(
              "../../core/analyzer/lifecycle-health-snapshots.js"
            );
            recordSnapshot(store.getDb(), report);
          } catch (err) {
            logger.warn("tool:analyze:prd_lifecycle_health:snapshot_failed", {
              error: String(err),
            });
          }
          logger.info("tool:analyze:prd_lifecycle_health:ok", {
            nodeId,
            passedAll: report.passedAll,
            passedCount: report.passedCount,
          });
          return mcpText({ ok: true, mode, ...report });
        }

        case "success_rate": {
          const { computeSuccessRate } = await import(
            "../../core/analyzer/lifecycle-health-snapshots.js"
          );
          const result = computeSuccessRate(store.getDb(), {
            window: window ?? 10,
            epicId: nodeId ?? null,
          });
          logger.info("tool:analyze:success_rate:ok", {
            samples: result.samples,
            passed: result.passed,
            successRate: result.successRate,
          });
          return mcpText({ ok: true, mode, ...result });
        }

        case "capacity_health": {
          const { computeCapacityHealth } = await import(
            "../../core/analyzer/capacity-health.js"
          );
          const sprintLabel = nodeId; // optional sprint filter via nodeId param
          const result = computeCapacityHealth(doc, sprintLabel);
          logger.info("tool:analyze:capacity_health:ok", {
            sprintLabel: result.sprintLabel,
            withinTolerance: result.withinTolerance,
          });
          return mcpText({ ok: true, mode, ...result });
        }

        case "evolution_audit": {
          const { analyzeEvolutionAudit } = await import(
            "../../core/analyzer/evolution-audit.js"
          );
          const result = analyzeEvolutionAudit(doc);
          logger.info("tool:analyze:evolution_audit:ok", {
            totalRegenerated: result.totalRegenerated,
            totalRegenerations: result.totalRegenerations,
          });
          return mcpText({ ok: true, mode, ...result });
        }

        case "harness_savings": {
          const { aggregateSavings } = await import(
            "../../core/harness/savings-ledger.js"
          );
          const project = store.getActiveProject();
          const projectId = project?.id ?? "default";
          const summary = aggregateSavings(store.getDb(), projectId);
          logger.info("tool:analyze:harness_savings:ok", {
            totalBlocks: summary.totalBlocks,
            totalSavingsTokens: summary.totalSavingsTokens,
          });
          return mcpText({ ok: true, mode, ...summary });
        }

        case "feature_depth": {
          const { join: joinPath } = await import("node:path");
          const { isGoAvailable, runFeatureDepthGo } = await import(
            "../../core/feature-depth/runner.js"
          );
          const { parseFeatureDepthAudit } = await import(
            "../../core/analyzer/feature-depth-mode.js"
          );
          if (!(await isGoAvailable())) {
            return mcpText({
              ok: false,
              mode,
              error: "go_not_available",
              hint: "Install Go ≥ 1.22 (https://go.dev/dl/) to run feature_depth",
            });
          }
          const cwd = process.cwd();
          const goResult = await runFeatureDepthGo({
            cwd,
            toolPath: joinPath(cwd, "tools/feature-depth"),
            args: ["-granularity=file", "-output=json", `-dir=${cwd}`],
          });
          if (!goResult.ok) {
            logger.warn("tool:analyze:feature_depth:go_failed", {
              exitCode: goResult.exitCode,
            });
            return mcpText({
              ok: false,
              mode,
              error: "go_run_failed",
              exitCode: goResult.exitCode,
              stderr: goResult.stderr.slice(0, 500),
            });
          }
          const parsed = parseFeatureDepthAudit(goResult.stdout);
          logger.info("tool:analyze:feature_depth:ok", {
            totalFiles: parsed.totalFiles,
            avgScore: parsed.avgScore,
          });
          return mcpText({ ok: true, mode, ...parsed });
        }

        default: {
          return mcpError(`Unknown analyze mode: ${mode as string}`);
        }
      }
    },
  );
}
