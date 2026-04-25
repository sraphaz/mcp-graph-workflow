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

import type { GraphDocument } from "../graph/graph-types.js";
import { BOOTSTRAP_TOOLS } from "../utils/constants.js";
import { nodeHasAc } from "../utils/ac-helpers.js";
import { parseAc } from "../analyzer/ac-parser.js";
import { checkDesignReadiness } from "../designer/definition-of-ready.js";
import { checkDefinitionOfDone } from "../implementer/definition-of-done.js";
import { checkValidationReadiness } from "../validator/definition-of-ready.js";
import { checkReviewReadiness } from "../reviewer/review-readiness.js";
import { checkHandoffReadiness } from "../handoff/delivery-checklist.js";
import { checkDeployReadiness } from "../deployer/deploy-readiness.js";
import { checkListeningReadiness } from "../listener/feedback-readiness.js";

export type LifecyclePhase =
  | "ANALYZE"
  | "DESIGN"
  | "PLAN"
  | "IMPLEMENT"
  | "VALIDATE"
  | "REVIEW"
  | "HANDOFF"
  | "DEPLOY"
  | "LISTENING";

/**
 * V11 Maestro Phase 3 — every analyze mode (53 total) lives in EXACTLY ONE phase.
 * The list mirrors the enum in `src/mcp/tools/analyze.ts`. Integrity is enforced
 * by `src/tests/get-modes-for-phase.test.ts` (no orphans, no duplicates).
 */
export const ALL_ANALYZE_MODES = [
  "prd_quality", "scope", "ready", "risk", "blockers", "cycles", "critical_path",
  "contract_coverage", "data_integrity", "decompose", "adr", "formula_consistency",
  "traceability", "coupling", "interfaces", "tech_risk", "design_ready",
  "implement_done", "tdd_check", "performance_budget", "progress", "state_completeness",
  "validate_ready", "done_integrity", "status_flow", "review_ready", "handoff_ready",
  "doc_completeness", "deploy_ready", "release_check", "listening_ready",
  "backlog_health", "sprint_health", "auto_ready", "scenario_coverage", "asset_blockers",
  "config_coverage", "metric_coverage", "concurrency_risk", "economy_simulation", "cfd",
  "code_sync", "smart_decompose", "security_scan", "code_quality", "test_coverage",
  "observability_check", "harness_scan", "harness_trend", "harness_advice",
  "harness_remediate", "adr_challenge", "orphan_tasks",
] as const;

export type AnalyzeMode = typeof ALL_ANALYZE_MODES[number];

const PHASE_MODE_MAP: Record<LifecyclePhase, ReadonlyArray<AnalyzeMode>> = {
  ANALYZE: [
    "prd_quality", "scope", "ready", "risk", "blockers",
    "decompose", "smart_decompose", "formula_consistency",
    "contract_coverage", "data_integrity",
  ],
  DESIGN: [
    "adr", "adr_challenge", "traceability", "coupling",
    "interfaces", "tech_risk", "design_ready",
  ],
  PLAN: [
    "backlog_health", "sprint_health", "performance_budget",
    "scenario_coverage", "asset_blockers", "config_coverage",
    "metric_coverage", "concurrency_risk", "critical_path", "cycles",
  ],
  IMPLEMENT: [
    "implement_done", "tdd_check", "progress", "code_sync",
    "code_quality", "test_coverage", "security_scan", "orphan_tasks",
  ],
  VALIDATE: [
    "validate_ready", "done_integrity", "status_flow",
    "observability_check", "state_completeness",
  ],
  REVIEW: [
    "review_ready", "harness_scan", "harness_trend",
    "harness_advice", "harness_remediate",
  ],
  HANDOFF: [
    "handoff_ready", "doc_completeness",
  ],
  DEPLOY: [
    "deploy_ready", "release_check",
  ],
  LISTENING: [
    "listening_ready", "economy_simulation", "cfd", "auto_ready",
  ],
};

/**
 * Modes that `graph_lifecycle({phase})` runs in batch.
 * Returns `[]` for unknown phases — no throw, safe for arbitrary input.
 */
export function getModesForPhase(phase: LifecyclePhase): AnalyzeMode[] {
  const modes = PHASE_MODE_MAP[phase];
  return modes ? [...modes] : [];
}

export interface McpAgentSuggestion {
  name: string;
  action: string;
  tools?: string[];
}

export interface PhaseGuidance {
  reminder: string;
  suggestedTools: string[];
  principles: string[];
  suggestedMcpAgents?: McpAgentSuggestion[];
  suggestedSkills?: string[];
}

import { TASK_TYPES, DESIGN_ONLY_TYPES, FEEDBACK_TYPES } from "../utils/node-type-sets.js";

export interface PhaseDetectionOptions {
  hasSnapshots?: boolean;
  phaseOverride?: LifecyclePhase | null;
}

/**
 * Detect the current lifecycle phase from the graph state.
 *
 * Priority order:
 * 1. Manual override (if provided)
 * 2. No nodes → ANALYZE
 * 3. Only design-type nodes → DESIGN
 * 4. Any task in_progress → IMPLEMENT
 * 5. All tasks done + new feedback nodes → LISTENING
 * 6. All tasks done + snapshots exist → HANDOFF
 * 7. All tasks done → REVIEW
 * 8. No sprints assigned → PLAN
 * 9. ≥50% tasks done (threshold for partial completion) → VALIDATE
 * 10. All tasks backlog/ready → PLAN
 * 11. Fallback → IMPLEMENT
 */
export function detectCurrentPhase(doc: GraphDocument, options?: PhaseDetectionOptions): LifecyclePhase {
  if (options?.phaseOverride) {
    return options.phaseOverride;
  }

  const { nodes } = doc;

  if (nodes.length === 0) {
    return "ANALYZE";
  }

  const tasks = nodes.filter((n) => TASK_TYPES.has(n.type));
  const hasOnlyDesignNodes = nodes.every((n) => DESIGN_ONLY_TYPES.has(n.type));

  // Check in_progress BEFORE design-only check to handle mixed graphs correctly
  const inProgress = tasks.filter((n) => n.status === "in_progress");
  if (inProgress.length > 0) {
    return "IMPLEMENT";
  }

  if (hasOnlyDesignNodes || tasks.length === 0) {
    return "DESIGN";
  }

  const doneTasks = tasks.filter((n) => n.status === "done");

  if (doneTasks.length === tasks.length && tasks.length > 0) {
    // All tasks done — check for LISTENING, HANDOFF, or REVIEW
    if (hasNewFeedbackNodes(nodes, doneTasks)) {
      return "LISTENING";
    }
    if (options?.hasSnapshots) {
      return "HANDOFF";
    }
    return "REVIEW";
  }

  const hasSprints = tasks.some((n) => n.sprint != null);

  if (!hasSprints) {
    return "PLAN";
  }

  // ≥50% done but not all → partial completion phase for validation
  if (doneTasks.length > 0 && doneTasks.length >= tasks.length * 0.5) {
    return "VALIDATE";
  }

  // Tasks with sprint but not started yet → still PLAN
  const notStarted = tasks.every((n) => n.status === "backlog" || n.status === "ready");
  if (notStarted) {
    return "PLAN";
  }

  return "IMPLEMENT";
}

/**
 * Check if new feedback/requirement nodes were added after all tasks were completed.
 * This signals the project has entered a feedback loop (LISTENING phase).
 */
function hasNewFeedbackNodes(
  nodes: GraphDocument["nodes"],
  doneTasks: GraphDocument["nodes"],
): boolean {
  const lastDoneTime = doneTasks.reduce((max, n) => {
    const t = n.updatedAt ?? n.createdAt;
    return t > max ? t : max;
  }, "");

  if (!lastDoneTime) return false;

  return nodes.some(
    (n) => FEEDBACK_TYPES.has(n.type) && n.createdAt > lastDoneTime,
  );
}

const GUIDANCE: Record<LifecyclePhase, PhaseGuidance> = {
  ANALYZE: {
    reminder: "ANALYZE: PRD + requisitos antes de código.",
    suggestedTools: ["import_prd", "add_node", "analyze", "validate_ac", "search"],
    principles: ["Definir antes de construir", "Requisitos mensuráveis"],
  },
  DESIGN: {
    reminder: "DESIGN: Arquitetura + ADRs + interfaces.",
    suggestedTools: ["add_node", "edge", "analyze", "export"],
    principles: ["Skeleton & Organs", "Interface-first"],
  },
  PLAN: {
    reminder: "PLAN: Sprint planning + decomposição + sync docs.",
    suggestedTools: ["plan_sprint", "analyze", "sync_stack_docs", "edge"],
    principles: ["Decomposição atômica", "Dependências explícitas"],
  },
  IMPLEMENT: {
    reminder: "IMPLEMENT: TDD Red→Green→Refactor. Test first.",
    suggestedTools: ["next", "context", "update_status", "validate", "analyze"],
    principles: ["TDD Red→Green→Refactor", "Anti-one-shot"],
  },
  VALIDATE: {
    reminder: "VALIDATE: E2E + AC verification.",
    suggestedTools: ["validate", "metrics", "analyze", "list"],
    principles: ["Zero tolerance regressões", "AC como contrato"],
  },
  REVIEW: {
    reminder: "REVIEW: Code review + blast radius.",
    suggestedTools: ["export", "metrics", "analyze"],
    principles: ["Blast radius check", "Non-regression rule"],
  },
  HANDOFF: {
    reminder: "HANDOFF: PR + docs + export grafo.",
    suggestedTools: ["export", "snapshot", "metrics", "analyze"],
    principles: ["Documentação como entrega", "Knowledge captured"],
  },
  DEPLOY: {
    reminder: "DEPLOY: CI + release + smoke tests.",
    suggestedTools: ["export", "snapshot", "analyze", "metrics"],
    principles: ["CI green before release", "Post-release validation"],
  },
  LISTENING: {
    reminder: "LISTENING: Feedback → novos nodes → novo ciclo.",
    suggestedTools: ["add_node", "import_prd", "search", "list", "analyze"],
    principles: ["Feedback contínuo", "Iteração incremental"],
  },
};

/** Get reminder, tools, and principles for a lifecycle phase. */
export function getPhaseGuidance(phase: LifecyclePhase): PhaseGuidance {
  return GUIDANCE[phase];
}

// ── Warnings ────────────────────────────────

export interface LifecycleWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
}

// ── Strictness Mode ────────────────────────────
export type StrictnessMode = "strict" | "advisory";

// ── Phase Gates ────────────────────────────────

export interface PhaseGateResult {
  allowed: boolean;
  reason: string | null;
  unmetConditions: string[];
}

type PhaseGateCheck = (doc: GraphDocument) => PhaseGateResult;

const PHASE_GATES: Partial<Record<`${LifecyclePhase}_to_${LifecyclePhase}`, PhaseGateCheck>> = {
  ANALYZE_to_DESIGN: (doc) => {
    const hasEpicOrRequirement = doc.nodes.some((n) => n.type === "epic" || n.type === "requirement");
    return {
      allowed: hasEpicOrRequirement,
      reason: hasEpicOrRequirement ? null : "Nenhum epic ou requirement encontrado",
      unmetConditions: hasEpicOrRequirement ? [] : ["Criar pelo menos 1 node tipo 'epic' ou 'requirement'"],
    };
  },
  DESIGN_to_PLAN: (doc) => {
    const report = checkDesignReadiness(doc);
    return {
      allowed: report.ready,
      reason: report.ready ? null : report.summary,
      unmetConditions: report.checks
        .filter((c) => c.severity === "required" && !c.passed)
        .map((c) => c.details),
    };
  },
  PLAN_to_IMPLEMENT: (doc) => {
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const hasSprints = tasks.some((n) => n.sprint != null);
    return {
      allowed: hasSprints,
      reason: hasSprints ? null : "Nenhuma task com sprint atribuído",
      unmetConditions: hasSprints ? [] : ["Atribuir sprint a pelo menos 1 task"],
    };
  },
  IMPLEMENT_to_VALIDATE: (doc) => {
    const report = checkValidationReadiness(doc);

    // Additional recommended check: ≥50% done tasks have testable AC
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const doneTasks = tasks.filter((n) => n.status === "done");
    const doneWithTestableAc = doneTasks.filter((n) => {
      const acs = n.acceptanceCriteria ?? [];
      return acs.some((ac) => parseAc(ac).isTestable);
    });
    const testableRatio = doneTasks.length > 0 ? doneWithTestableAc.length / doneTasks.length : 0;

    const conditions = report.checks
      .filter((c) => c.severity === "required" && !c.passed)
      .map((c) => c.details);

    // Testable AC is recommended (warning), not required
    if (testableRatio < 0.5 && doneTasks.length > 0) {
      conditions.push(`Recomendado: ≥50% das done tasks com AC testável (atual: ${Math.round(testableRatio * 100)}%)`);
    }

    return {
      allowed: report.ready,
      reason: report.ready ? null : report.summary,
      unmetConditions: conditions,
    };
  },
  VALIDATE_to_REVIEW: (doc) => {
    const report = checkReviewReadiness(doc);
    return {
      allowed: report.ready,
      reason: report.ready ? null : report.summary,
      unmetConditions: report.checks
        .filter((c) => c.severity === "required" && !c.passed)
        .map((c) => c.details),
    };
  },
  REVIEW_to_HANDOFF: (doc) => {
    const report = checkHandoffReadiness(doc);
    return {
      allowed: report.ready,
      reason: report.ready ? null : report.summary,
      unmetConditions: report.checks
        .filter((c) => c.severity === "required" && !c.passed)
        .map((c) => c.details),
    };
  },
  HANDOFF_to_DEPLOY: (doc) => {
    const report = checkDeployReadiness(doc);
    return {
      allowed: report.ready,
      reason: report.ready ? null : report.summary,
      unmetConditions: report.checks
        .filter((c) => c.severity === "required" && !c.passed)
        .map((c) => c.details),
    };
  },
  HANDOFF_to_LISTENING: (doc) => {
    const report = checkListeningReadiness(doc);
    return {
      allowed: report.ready,
      reason: report.ready ? null : report.summary,
      unmetConditions: report.checks
        .filter((c) => c.severity === "required" && !c.passed)
        .map((c) => c.details),
    };
  },
  DEPLOY_to_LISTENING: (doc) => {
    const report = checkListeningReadiness(doc);
    return {
      allowed: report.ready,
      reason: report.ready ? null : report.summary,
      unmetConditions: report.checks
        .filter((c) => c.severity === "required" && !c.passed)
        .map((c) => c.details),
    };
  },
};

/**
 * Validate whether a phase transition is allowed based on graph state.
 */
export function validatePhaseTransition(
  doc: GraphDocument,
  fromPhase: LifecyclePhase,
  toPhase: LifecyclePhase,
): PhaseGateResult {
  const key = `${fromPhase}_to_${toPhase}` as `${LifecyclePhase}_to_${LifecyclePhase}`;
  const gate = PHASE_GATES[key];

  if (!gate) {
    // No gate defined for this transition — allowed by default
    return { allowed: true, reason: null, unmetConditions: [] };
  }

  return gate(doc);
}

// ── Tool Phase Restrictions ────────────────────

const PHASE_RECOMMENDED_TOOLS: Record<LifecyclePhase, Set<string>> = {
  ANALYZE: new Set(["import_prd", "node", "edge", "search", "analyze"]),
  DESIGN: new Set(["node", "edge", "analyze", "write_memory", "read_memory"]),
  PLAN: new Set(["plan_sprint", "analyze", "sync_stack_docs", "decompose", "node", "edge"]),
  IMPLEMENT: new Set(["next", "context", "update_status", "node", "analyze", "write_memory", "validate", "validate_task", "edge"]),
  VALIDATE: new Set(["validate", "analyze", "update_status", "validate_task"]),
  REVIEW: new Set(["analyze", "export", "metrics", "validate", "validate_task"]),
  HANDOFF: new Set(["export", "snapshot", "write_memory", "validate", "validate_task"]),
  DEPLOY: new Set(["export", "snapshot", "analyze", "metrics", "write_memory"]),
  LISTENING: new Set(["import_prd", "node", "analyze", "manage_skill", "validate_task"]),
};

/** Tools exempt from phase gating — includes bootstrap tools + read-only operations. */
const PHASE_EXEMPT_TOOLS = new Set([
  ...BOOTSTRAP_TOOLS,
  "list", "show", "search", "metrics", "export", "snapshot",
  "context", "knowledge", "next", "analyze",
  "read_memory", "list_memories", "list_skills",
  "update_node",  // deprecated wrapper for node(action:update) — exempt from phase warnings
]);

/**
 * Check if a tool is allowed in the current phase.
 * Returns warnings with severity based on strictness mode.
 */
/** Check if a tool is allowed in the current phase. */
export function checkToolGate(
  doc: GraphDocument,
  phase: LifecyclePhase,
  toolName: string,
  mode: StrictnessMode = "strict",
): LifecycleWarning[] {
  if (PHASE_EXEMPT_TOOLS.has(toolName)) {
    return [];
  }

  const recommended = PHASE_RECOMMENDED_TOOLS[phase];
  if (recommended?.has(toolName)) {
    return [];
  }

  // If the tool isn't known to any phase's recommended list, it's an unknown/external tool — allow it
  const isKnownTool = Object.values(PHASE_RECOMMENDED_TOOLS).some((s) => s.has(toolName));
  if (!isKnownTool) {
    return [];
  }

  const severity = mode === "strict" ? "error" : "warning";
  return [{
    code: "tool_phase_blocked",
    message: `Tool "${toolName}" não é recomendada na fase ${phase}. Avance para a fase apropriada primeiro.`,
    severity,
  }];
}

// ── Status Gate ────────────────────────────────

export interface StatusGateResult {
  warnings: LifecycleWarning[];
}

/**
 * Check if a status transition is allowed for a specific node in the current phase.
 */
export function checkStatusGate(
  doc: GraphDocument,
  phase: LifecyclePhase,
  nodeId: string,
  newStatus: string,
  mode: StrictnessMode = "strict",
): StatusGateResult {
  const warnings: LifecycleWarning[] = [];
  const severity = mode === "strict" ? "error" : "warning";

  const node = doc.nodes.find((n) => n.id === nodeId);

  if (newStatus === "done" && phase === "IMPLEMENT") {
    // Check if node or parent has acceptance criteria (inline or child AC nodes)
    const hasAC = nodeHasAc(doc, nodeId);
    const parentId = node?.parentId;
    const parentHasAC = parentId ? nodeHasAc(doc, parentId) : false;
    const globalAC = doc.nodes.some((n) => n.type === "acceptance_criteria");

    if (!hasAC && !parentHasAC && !globalAC) {
      warnings.push({
        code: "done_without_acceptance_criteria",
        message: `Node "${nodeId}" marcado como done sem acceptance criteria definidos.`,
        severity,
      });
    }

    // DoD pre-check — lightweight Definition of Done validation
    // Only fire for nodes that have AC (the no-AC case is already handled above)
    if (hasAC || parentHasAC || globalAC) {
      const dodReport = checkDefinitionOfDone(doc, nodeId);
      if (!dodReport.ready) {
        const failedRequired = dodReport.checks
          .filter((c) => c.severity === "required" && !c.passed)
          .map((c) => c.name);
        warnings.push({
          code: "done_without_dod",
          message: `Node "${nodeId}" não atende Definition of Done: ${failedRequired.join(", ")} (score: ${dodReport.score}, grade: ${dodReport.grade}).`,
          severity: "warning", // Always warning — DoD is informational guidance
        });
      }
    }
  }

  if (newStatus === "in_progress" && phase === "PLAN") {
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const taskNode = tasks.find((n) => n.id === nodeId);
    if (taskNode && !taskNode.sprint) {
      warnings.push({
        code: "in_progress_without_sprint",
        message: `Task "${nodeId}" iniciada sem sprint atribuído.`,
        severity,
      });
    }
  }

  if (newStatus === "done" && node && node.status !== "in_progress") {
    warnings.push({
      code: "done_without_in_progress",
      message: `Node "${nodeId}" marcado como done sem ter passado por in_progress (status atual: ${node.status}).`,
      severity: "warning", // Always warning, even in strict — this is a soft guideline
    });
  }

  return { warnings };
}

// ── Tool Prerequisite Enforcement ────────────────

export type PrerequisiteScope = "node" | "project";

export interface PrerequisiteRequiredTool {
  tool: string;
  /** Alternative tool names that also satisfy this prerequisite (e.g., rag_context for context). */
  aliases?: string[];
  args?: string;
  scope: PrerequisiteScope;
}

export interface PrerequisiteRule {
  triggerTool: string;
  triggerCondition?: (args: Record<string, unknown>) => boolean;
  requiredTools: PrerequisiteRequiredTool[];
  description: string;
}

/** Prerequisite rules keyed by lifecycle phase. */
export const PHASE_PREREQUISITES: Record<LifecyclePhase, PrerequisiteRule[]> = {
  ANALYZE: [],
  DESIGN: [
    {
      triggerTool: "set_phase",
      triggerCondition: (args) => args.phase === "PLAN",
      requiredTools: [
        { tool: "analyze", args: "design_ready", scope: "project" },
      ],
      description: "Antes de DESIGN→PLAN: chamar `analyze(design_ready)`",
    },
  ],
  PLAN: [
    {
      triggerTool: "set_phase",
      triggerCondition: (args) => args.phase === "IMPLEMENT",
      requiredTools: [
        { tool: "sync_stack_docs", scope: "project" },
        { tool: "plan_sprint", scope: "project" },
      ],
      description: "Antes de PLAN→IMPLEMENT: chamar `sync_stack_docs` + `plan_sprint`",
    },
  ],
  IMPLEMENT: [
    {
      triggerTool: "update_status",
      triggerCondition: (args) => args.status === "in_progress",
      requiredTools: [
        { tool: "next", scope: "project" },
      ],
      description: "Antes de in_progress: chamar `next` para carregar contexto da task",
    },
    {
      triggerTool: "update_status",
      triggerCondition: (args) => args.status === "done",
      requiredTools: [
        { tool: "context", scope: "node" },
        { tool: "context", aliases: ["rag_context"], scope: "project" },
        { tool: "analyze", args: "implement_done", scope: "node" },
      ],
      description: "Antes de done: chamar `context` + `rag_context` + `analyze(implement_done)`",
    },
  ],
  VALIDATE: [
    {
      triggerTool: "update_status",
      triggerCondition: (args) => args.status === "done",
      requiredTools: [
        { tool: "validate", scope: "node" },
        { tool: "analyze", args: "validate_ready", scope: "project" },
      ],
      description: "Antes de done em VALIDATE: chamar `validate(ac)` + `analyze(validate_ready)`",
    },
  ],
  REVIEW: [
    {
      triggerTool: "set_phase",
      triggerCondition: (args) => args.phase === "HANDOFF",
      requiredTools: [
        { tool: "analyze", args: "review_ready", scope: "project" },
        { tool: "export", scope: "project" },
      ],
      description: "Antes de REVIEW→HANDOFF: chamar `analyze(review_ready)` + `export`",
    },
  ],
  HANDOFF: [
    {
      triggerTool: "set_phase",
      triggerCondition: (args) => args.phase === "DEPLOY",
      requiredTools: [
        { tool: "analyze", args: "deploy_ready", scope: "project" },
        { tool: "snapshot", scope: "project" },
        { tool: "write_memory", scope: "project" },
      ],
      description: "Antes de HANDOFF→DEPLOY: chamar `analyze(deploy_ready)` + `snapshot` + `write_memory`",
    },
    {
      triggerTool: "set_phase",
      triggerCondition: (args) => args.phase === "LISTENING",
      requiredTools: [
        { tool: "analyze", args: "handoff_ready", scope: "project" },
        { tool: "snapshot", scope: "project" },
        { tool: "write_memory", scope: "project" },
      ],
      description: "Antes de HANDOFF→LISTENING: chamar `analyze(handoff_ready)` + `snapshot` + `write_memory`",
    },
  ],
  DEPLOY: [
    {
      triggerTool: "set_phase",
      triggerCondition: (args) => args.phase === "LISTENING",
      requiredTools: [
        { tool: "analyze", args: "deploy_ready", scope: "project" },
        { tool: "snapshot", scope: "project" },
      ],
      description: "Antes de DEPLOY→LISTENING: chamar `analyze(deploy_ready)` + `snapshot`",
    },
  ],
  LISTENING: [],
};

/**
 * Check if mandatory prerequisite tools have been called before allowing the current tool.
 * Returns warnings with severity based on strictness mode.
 */
export function checkPrerequisiteGate(
  phase: LifecyclePhase,
  toolName: string,
  toolArgs: Record<string, unknown>,
  nodeId: string | undefined,
  hasBeenCalled: (nodeId: string | null, tool: string, args?: string) => boolean,
  mode: StrictnessMode,
): LifecycleWarning[] {
  const rules = PHASE_PREREQUISITES[phase];
  if (!rules || rules.length === 0) return [];

  const warnings: LifecycleWarning[] = [];
  const severity = mode === "strict" ? "error" : "warning";

  for (const rule of rules) {
    if (rule.triggerTool !== toolName) continue;
    if (rule.triggerCondition && !rule.triggerCondition(toolArgs)) continue;

    for (const req of rule.requiredTools) {
      const lookupNodeId = req.scope === "node" ? (nodeId ?? null) : null;
      let called = hasBeenCalled(lookupNodeId, req.tool, req.args);

      // Check aliases (e.g., rag_context satisfies context requirement)
      if (!called && req.aliases) {
        for (const alias of req.aliases) {
          if (hasBeenCalled(lookupNodeId, alias, req.args)) {
            called = true;
            break;
          }
        }
      }

      if (!called) {
        const scopeHint = req.scope === "node" && nodeId
          ? ` para node "${nodeId}"`
          : "";
        const argsHint = req.args ? `(${req.args})` : "";
        warnings.push({
          code: "prerequisite_missing",
          message: `Pré-requisito não atendido: chamar \`${req.tool}${argsHint}\`${scopeHint} antes de \`${toolName}\`. ${rule.description}`,
          severity,
        });
      }
    }
  }

  return warnings;
}

/**
 * Detect anti-pattern behaviors based on current phase, graph state, and tool being called.
 * In advisory mode: returns warnings (never blocks execution).
 * In strict mode: returns errors that block execution.
 */
export function detectWarnings(
  doc: GraphDocument,
  phase: LifecyclePhase,
  toolName: string,
  mode: StrictnessMode = "strict",
): LifecycleWarning[] {
  const warnings: LifecycleWarning[] = [];
  const guidance = GUIDANCE[phase];

  // Check tool phase restrictions (strict → error, advisory → warning)
  const gateWarnings = checkToolGate(doc, phase, toolName, mode);
  warnings.push(...gateWarnings);

  // Warn if tool is not recommended for current phase (exempt tools skip this)
  if (!PHASE_EXEMPT_TOOLS.has(toolName) && !guidance.suggestedTools.includes(toolName)) {
    warnings.push({
      code: "tool_not_recommended",
      message: `Tool "${toolName}" não é recomendada para fase ${phase}. Sugeridas: ${guidance.suggestedTools.join(", ")}`,
      severity: "info",
    });
  }

  // Phase-specific warnings
  if (phase === "ANALYZE" && toolName === "update_status") {
    warnings.push({
      code: "premature_status_change",
      message: "Fase ANALYZE — defina requisitos antes de implementar. Mudança de status prematura.",
      severity: mode === "strict" ? "error" : "warning",
    });
  }

  if (phase === "PLAN" && toolName === "update_status") {
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const hasSprints = tasks.some((n) => n.sprint != null);
    if (!hasSprints) {
      warnings.push({
        code: "no_sprint_assigned",
        message: "Nenhum sprint atribuído. Atribua sprints antes de iniciar tasks.",
        severity: "warning",
      });
    }
  }

  if (phase === "IMPLEMENT" && toolName === "update_status") {
    const hasAcceptanceCriteria = doc.nodes.some(
      (n) => n.type === "acceptance_criteria" ||
             (n.acceptanceCriteria && n.acceptanceCriteria.length > 0),
    );
    if (!hasAcceptanceCriteria) {
      warnings.push({
        code: "no_acceptance_criteria",
        message: "Nenhum critério de aceitação definido. Considere adicionar antes de concluir tasks.",
        severity: "warning",
      });
    }
  }

  return warnings;
}
