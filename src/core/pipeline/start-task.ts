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
 * Pipeline compound operation: start_task
 * Composes: next + context + context(rag) + TDD hints + update_status(in_progress)
 * Reduces 5-6 tool calls to 1.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import type { EnhancedNextResult } from "../planner/enhanced-next.js";
import { getSharedHookBus } from "../hooks/shared-hook-bus.js";
import type { TaskContext } from "../context/compact-context.js";
import type { AssembledContext } from "../context/context-assembler.js";
import { findEnhancedNextTask } from "../planner/enhanced-next.js";
import { computeTaskReadinessScore, type TaskReadinessScore } from "../planner/task-readiness-score.js";
import { buildTaskContext } from "../context/compact-context.js";
import type { GraphSnapshot } from "../store/graph-snapshot-cache.js";
import { assembleContext } from "../context/context-assembler.js";
import { generateTddHints, generateTddHintsFromTexts } from "../implementer/tdd-checker.js";
import { findRelevantDomainSkills, type DomainSkillMatch } from "../skills/domain-skill-retrieval.js";
import { join as joinPath } from "node:path";
import type { TddHint } from "../../schemas/implementer-schema.js";
import { getHarnessPreflightWarning } from "../harness/harness-preflight.js";
import type { HarnessPreflightWarning } from "../harness/harness-preflight.js";
import { runHarnessScan } from "../harness/harness-scan-runner.js";
import { evaluate as evaluateRemediations } from "../harness/remediation-engine.js";
import { computeEmpiricalModelHint } from "../evals/empirical-model-hint.js";
import { EvalRunStore } from "../store/eval-run-store.js";
import type { ModelPreference } from "../planner/task-readiness-score.js";
import type { RemediationSuggestion } from "../harness/violation-detail.js";
import type { LockManager } from "../store/lock-manager.js";
import {
  AmbiguityAuditSchema,
  shouldWarnMissingAudit,
  type AmbiguityAudit,
} from "../decisions/ambiguity-audit-types.js";
import { LockConflictError } from "../utils/errors.js";
import { enforceWipAndFileGates } from "./wip-gate.js";
import { assembleSiblingContext } from "./assemble-sibling-context.js";
import { TaskPrefetcher } from "../planner/task-prefetcher.js";
import { createCheckpoint, type GraphCheckpoint } from "../autonomy/graph-rollback.js";
import { createShadowBranch, type ShadowBranchHandle } from "../autonomy/shadow-branch.js";
import { createLogger } from "../utils/logger.js";
import { now } from "../utils/time.js";
import { extractOfferedDocIds } from "../rag/rag-feedback.js";
import { maybeRunMemoryDynamicsTick, type DynamicsTickResult } from "../rag/memory-dynamics-tick.js";

const log = createLogger({ layer: "core", source: "start-task.ts" });

// Module-level singleton for task context prefetching (CPU pipeline pattern)
export const taskPrefetcher = new TaskPrefetcher({ ttlMs: 5 * 60 * 1000 });

export interface StartTaskOptions {
  nodeId?: string;
  contextDetail?: "summary" | "standard" | "deep";
  ragBudget?: number;
  autoStart?: boolean;
  /** Agent ID for teamTask mode — enables lock-based task claiming */
  agentId?: string;
  /** LockManager instance for teamTask mode */
  lockManager?: LockManager;
  /** Max concurrent in_progress tasks (teamTask mode; default: 3) */
  wipLimit?: number;
  /** Throw on WIP limit exceeded; false = advisory warning only (default: false) */
  wipStrict?: boolean;
  /** Files this task will touch — used for file-overlap conflict detection */
  touchedFiles?: readonly string[];
  /**
   * v11 Context-Pollination: token budget cap for assembled siblingContext
   * (default: 4000). Override via this flag to accommodate larger context
   * windows (e.g. Haiku 200k) or stress-test with forced small budget.
   */
  siblingBudget?: number;
  /**
   * §EPIC-13.2 — Ambiguity audit submitted by the agent before execution.
   * When present, persisted in `node.metadata.ambiguityAudit`. When absent
   * and the task has ≥3 ACs, surfaces an `ambiguityAuditWarning` in the result.
   */
  ambiguityAudit?: AmbiguityAudit;
}

export interface StartTaskResult {
  task: EnhancedNextResult;
  context: TaskContext | null;
  ragContext: AssembledContext | null;
  tddHints: TddHint[];
  startedAt: string | null;
  harnessWarning: HarnessPreflightWarning | null;
  /** Top 3 remediation suggestions when harness score < 70 */
  topRemediations?: RemediationSuggestion[];
  /** Lease token for task lock (teamTask mode only) */
  leaseToken?: string;
  /** Whether context was served from prefetch cache */
  prefetchHit?: boolean;
  /** Graph checkpoint for rollback on failure (Phase D — Autonomous Loop) */
  checkpoint?: GraphCheckpoint;
  /** Shadow branch handle for isolated execution (Phase D — Git Transactional Layer) */
  shadowBranch?: ShadowBranchHandle;
  /**
   * Model routing hint — combines xpSize, AC quality, harness, dependency depth
   * and issue-pattern history into a preferred Claude model (haiku/sonnet/opus).
   * Agent hosts that honor this field can route cheap atomic work to Haiku
   * without a task-readiness regression.
   */
  modelHint?: TaskReadinessScore;
  /**
   * v11 Context-Pollination: markdown-rendered outputs from done sibling
   * subtasks this task depends on. Empty string when the task has no parent
   * epic, no depends_on edges to done siblings, or no artifacts persisted.
   * Ready to inject into the agent prompt.
   */
  siblingContext: string;
  /** Count of ancestor siblings dropped by the budget cap (0 when no truncation). */
  siblingTruncatedCount: number;
  /**
   * Domain skills retrieved by trigger-token match against the task title +
   * description. Empty array when no triggers matched. Caller can render
   * `formatDomainSkillsBlock(domainSkills)` into the agent's prompt.
   */
  domainSkills: DomainSkillMatch[];
  /**
   * §EPIC-13.2 — Advisory warning when the task has ≥3 ACs but no
   * `ambiguityAudit` was submitted. Null when the audit was provided
   * or the task has fewer than 3 ACs.
   */
  ambiguityAuditWarning: string | null;
  /**
   * Auto-cadence memory dynamics tick (Hu et al. 2026 — auto-learning loop).
   * Set when start_task fired the opportunistic decay/consolidate/forget
   * pass. `ran: false, reason: "rate_limited"` when the previous tick was
   * within the interval window. Caller-side telemetry only — no behavior
   * depends on this field.
   */
  memoryDynamicsTick?: import("../rag/memory-dynamics-tick.js").DynamicsTickResult;
}

/**
 * Find next task (or specific nodeId), load context + RAG + TDD hints,
 * and optionally mark as in_progress — all in one call.
 */
export function startTask(
  store: SqliteStore,
  options?: StartTaskOptions,
): StartTaskResult | null {
  if (!store) return null;
  const { nodeId, contextDetail, ragBudget, autoStart = true, agentId, lockManager, wipLimit, wipStrict, touchedFiles, siblingBudget, ambiguityAudit } = options ?? {};

  const doc = store.toGraphDocument();
  if (!doc?.nodes) return null;

  // 1. Find next task or lookup specific nodeId
  let enhanced: EnhancedNextResult | null;
  if (nodeId) {
    const node = doc.nodes.find((n) => n.id === nodeId);
    if (!node) {
      log.warn("pipeline:start_task:node_not_found", { nodeId });
      return null;
    }
    // Build a minimal EnhancedNextResult for the specific node
    enhanced = {
      task: { node, reason: `Specific node requested: ${nodeId}` },
      knowledgeCoverage: 0,
      velocityContext: { avgCompletionHours: 0, estimatedHours: 0 },
      enhancedReason: `Manually selected task: ${node.title}`,
    };
  } else {
    enhanced = findEnhancedNextTask(doc, store, { lockManager, agentId });
  }

  if (!enhanced) {
    log.info("pipeline:start_task:no_tasks");
    return null;
  }

  // 0. Auto-cadence memory-dynamics tick (Hu et al. 2026 — across-session
  //    auto-learning). Self-rate-limited via project_settings; closes the
  //    cadence gap where signals accumulate but policy update was gated on
  //    a manual knowledge(reindex) call. Failure is logged and never blocks.
  let memoryDynamicsTick: DynamicsTickResult | undefined;
  try {
    memoryDynamicsTick = maybeRunMemoryDynamicsTick(store);
    if (memoryDynamicsTick.ran) {
      log.info("pipeline:start_task:memory_dynamics_tick", { ...memoryDynamicsTick });
    }
  } catch (err) {
    log.warn("pipeline:start_task:memory_dynamics_tick_failed", { error: String(err) });
  }

  const taskNode = enhanced.task.node;

  // 2. Build task context — reuse the doc snapshot already loaded above so
  // buildTaskContext resolves neighbors O(1) per lookup against in-memory
  // arrays instead of hitting SQLite via getChildNodes/getEdgesTo/getEdgesFrom.
  let context: TaskContext | null = null;
  try {
    const snapshot: GraphSnapshot = { nodes: doc.nodes, edges: doc.edges };
    context = buildTaskContext(store, taskNode.id, snapshot);
  } catch (err) {
    log.warn("pipeline:start_task:context_failed", { error: String(err) });
  }

  // 3. Build RAG context (check prefetcher cache first — CPU pipeline pattern)
  let ragContext: AssembledContext | null = null;
  let prefetchHit = false;
  const prefetchedData = taskPrefetcher.get(taskNode.id);
  if (prefetchedData) {
    // Prefetch hit — skip RAG assembly
    prefetchHit = true;
    log.info("pipeline:start_task:prefetch_hit", { nodeId: taskNode.id });
    try {
      ragContext = JSON.parse(prefetchedData.context) as AssembledContext;
    } catch {
      ragContext = null;
      prefetchHit = false;
    }
  }

  if (!ragContext) {
    // Prefetch miss — build RAG context normally
    taskPrefetcher.invalidateIfMismatch(taskNode.id);
    try {
      ragContext = assembleContext(store, taskNode.title, {
        tokenBudget: ragBudget ?? 4000,
        tier: contextDetail ?? "standard",
      });
    } catch (err) {
      log.warn("pipeline:start_task:rag_failed", { error: String(err) });
    }
  }

  // 3b. Persist the docIds the RAG context surfaced so finish_task can score
  //     them later (paper §7.3 — RAG-citation → quality feedback loop).
  if (ragContext?.sections?.length) {
    try {
      const ragOffered = extractOfferedDocIds(ragContext.sections);
      if (ragOffered.length > 0) {
        const existingMeta = (taskNode.metadata as Record<string, unknown> | undefined) ?? {};
        store.updateNode(taskNode.id, { metadata: { ...existingMeta, ragOffered } });
        log.debug("pipeline:start_task:rag_offered_persisted", { nodeId: taskNode.id, count: ragOffered.length });
      }
    } catch (err) {
      log.warn("pipeline:start_task:rag_offered_failed", { error: String(err) });
    }
  }

  // 4. Generate TDD hints from AC
  const acChildNodes = (doc.nodes ?? []).filter(
    (n) => n?.type === "acceptance_criteria" && n?.parentId === taskNode.id,
  );
  const acTexts = [
    ...(taskNode?.acceptanceCriteria ?? []),
    ...acChildNodes.map((n) => n?.title ?? ""),
  ].filter(Boolean);
  const tddHints = acTexts.length > 0
    ? generateTddHintsFromTexts(acTexts)
    : generateTddHints(taskNode);

  // 5. Harness pre-flight warning (non-blocking, advisory)
  let harnessWarning: HarnessPreflightWarning | null = null;
  try {
    harnessWarning = getHarnessPreflightWarning(store.getDb());
  } catch (err) {
    log.warn("pipeline:start_task:harness_preflight_failed", { error: String(err) });
  }

  // 5b. Top remediation suggestions when score < 70 (non-blocking)
  let topRemediations: RemediationSuggestion[] | undefined;
  try {
    if (harnessWarning && harnessWarning.score < 70) {
      const scan = runHarnessScan(process.cwd(), store.getDb(), undefined, { collectViolations: true });
      if (scan.violations && scan.violations.length > 0) {
        topRemediations = evaluateRemediations(scan.violations, store.getDb()).slice(0, 3);
      }
    }
  } catch (err) {
    log.warn("pipeline:start_task:remediation_preflight_failed", { error: String(err) });
  }

  // 5c. Compute a model-routing hint from the same signals the graph already owns.
  // Pure computation — never throws, cheap (< 1ms for typical graphs).
  // Feeds the primary touched file's prior feature-depth baseline (if any)
  // into the readiness aggregator — fragile files surface earlier.
  // §EPIC-18.AC5 — when prior eval_run rows exist for this tool×model,
  // empirical pass-rate overrides the heuristic recommendation.
  let modelHint: TaskReadinessScore | undefined;
  try {
    let empiricalOverride: { model: ModelPreference; basedOn: number; passRate: number } | undefined;
    try {
      const runs = new EvalRunStore(store.getDb());
      const empirical = computeEmpiricalModelHint(runs, { tool: "start_task", limit: 50 });
      if (empirical && (empirical.recommended === "haiku" || empirical.recommended === "sonnet" || empirical.recommended === "opus")) {
        empiricalOverride = {
          model: empirical.recommended,
          basedOn: empirical.basedOn,
          passRate: empirical.passRate,
        };
      }
    } catch (err) {
      log.debug("pipeline:start_task:empirical_hint_unavailable", { error: String(err) });
    }

    modelHint = computeTaskReadinessScore(taskNode, doc, {
      harnessScore: harnessWarning ? harnessWarning.score : null,
      featureDepthScore: null,
      empiricalOverride,
    });
  } catch (err) {
    log.warn("pipeline:start_task:model_hint_failed", { error: String(err) });
  }

  // 6. Auto-start if requested
  let startedAt: string | null = null;
  let leaseToken: string | undefined;
  if (autoStart) {
    // WIP gate — must run before lock acquisition so status is never mutated on limit breach
    enforceWipAndFileGates(store, {
      teamTask: !!(lockManager && agentId),
      wipLimit: wipLimit ?? 3,
      wipStrict: wipStrict ?? false,
      nodeId: taskNode.id,
      agentId,
      touchedFiles,
      lockManager,
    });
    try {
      if (lockManager && agentId) {
        // teamTask mode: atomic claim with lock
        const lock = lockManager.acquire(`task:${taskNode.id}`, agentId, 600); // 10min TTL
        store.updateNodeStatus(taskNode.id, "in_progress");
        leaseToken = lock.leaseToken;
        log.info("pipeline:start_task:claimed", { nodeId: taskNode.id, agentId, leaseToken });
      } else {
        // Single-terminal mode: no lock
        store.updateNodeStatus(taskNode.id, "in_progress");
      }
      startedAt = now();
      void getSharedHookBus().emit({
        channel: "task:pre-execute",
        timestamp: startedAt,
        payload: { nodeId: taskNode.id, ...(agentId ? { agentId } : {}) },
      });
    } catch (err) {
      void getSharedHookBus().emit({
        channel: "task:error",
        timestamp: now(),
        payload: {
          nodeId: taskNode.id,
          phase: "start_task",
          error: err instanceof Error ? err.message : String(err),
          ...(agentId ? { agentId } : {}),
        },
      });
      if (err instanceof LockConflictError) {
        log.warn("pipeline:start_task:lock_conflict", { nodeId: taskNode.id, agentId, error: String(err) });
        throw err; // Propagate lock conflicts to caller
      }
      log.warn("pipeline:start_task:auto_start_failed", { error: String(err) });
    }
  }

  // 6a.1 Store harness baseline score for regression gate in finish_task
  if (startedAt) {
    try {
      const baselineRow = store.getDb()
        .prepare("SELECT score FROM harness_history ORDER BY timestamp DESC LIMIT 1")
        .get() as { score: number } | undefined;
      if (baselineRow) {
        const existingMeta = (taskNode.metadata as Record<string, unknown> | undefined) ?? {};
        store.updateNode(taskNode.id, { metadata: { ...existingMeta, _harnessBaseline: baselineRow.score } });
        log.debug("pipeline:start_task:harness_baseline_stored", { nodeId: taskNode.id, score: baselineRow.score });
      }
    } catch (err) {
      log.warn("pipeline:start_task:harness_baseline_failed", { error: String(err) });
    }
  }

  // 6b. Create checkpoint for rollback on failure (Phase D — Autonomous Loop)
  let checkpoint: GraphCheckpoint | undefined;
  let shadowBranch: ShadowBranchHandle | undefined;
  if (startedAt) {
    try {
      checkpoint = createCheckpoint(store, taskNode.id);
      log.info("pipeline:start_task:checkpoint", { nodeId: taskNode.id, snapshotId: checkpoint.snapshotId });
    } catch (err) {
      log.warn("pipeline:start_task:checkpoint_failed", { error: String(err) });
    }

    // 6c. Create shadow branch for isolated execution (Phase D — Git Transactional Layer)
    try {
      const branchResult = createShadowBranch(taskNode.id);
      if (branchResult.created) {
        shadowBranch = branchResult;
        log.info("pipeline:start_task:shadow_branch", { nodeId: taskNode.id, branch: branchResult.branchName, worktreePath: branchResult.worktreePath });
      }
    } catch (err) {
      log.warn("pipeline:start_task:shadow_branch_failed", { error: String(err) });
    }
  }

  // v11 Context-Pollination: assemble sibling artifacts from the parent epic.
  // Empty string when task has no parentId (standalone), no depends_on edges to
  // done siblings, or no artifacts persisted.
  let siblingContext = "";
  let siblingTruncatedCount = 0;
  if (taskNode.parentId) {
    try {
      const assembled = assembleSiblingContext(store, {
        epicId: taskNode.parentId,
        subtaskId: taskNode.id,
        tokenBudget: siblingBudget,
      });
      siblingContext = assembled.markdown;
      siblingTruncatedCount = assembled.truncatedCount;
    } catch (err) {
      log.warn("pipeline:start_task:sibling_assembly_failed", {
        nodeId: taskNode.id,
        error: String(err),
      });
    }
  }

  log.info("pipeline:start_task:ok", {
    nodeId: taskNode.id,
    title: taskNode.title,
    autoStart,
    hasTddHints: tddHints.length > 0,
    teamTask: !!lockManager,
    siblingContextLen: siblingContext.length,
    siblingTruncatedCount,
  });

  let domainSkills: DomainSkillMatch[] = [];
  try {
    const taskNode = enhanced?.task?.node;
    const query = `${taskNode?.title ?? ""} ${taskNode?.description ?? ""}`.trim();
    if (query.length > 0) {
      domainSkills = findRelevantDomainSkills(
        joinPath(process.cwd(), "src", "skills", "domain"),
        query,
        { limit: 5 },
      );
    }
  } catch (e) {
    log.debug("intentional swallow", { error: e, reason: "non-fatal, skill retrieval is advisory" });
  }

  // §EPIC-13.2 — persist ambiguityAudit + emit advisory warning
  let ambiguityAuditWarning: string | null = null;
  let auditedAudit: AmbiguityAudit | undefined;
  if (ambiguityAudit !== undefined) {
    const parsed = AmbiguityAuditSchema.safeParse(ambiguityAudit);
    if (parsed.success) {
      auditedAudit = parsed.data;
      try {
        const existingMeta = (taskNode.metadata as Record<string, unknown> | undefined) ?? {};
        store.updateNode(taskNode.id, {
          metadata: { ...existingMeta, ambiguityAudit: auditedAudit },
        });
      } catch (err) {
        log.warn("pipeline:start_task:ambiguity_audit_persist_failed", { error: String(err) });
      }
    } else {
      log.warn("pipeline:start_task:ambiguity_audit_invalid", { issues: parsed.error.issues });
    }
  }
  const acCountForAudit = (taskNode.acceptanceCriteria?.length ?? 0)
    + doc.nodes.filter((n) => n.type === "acceptance_criteria" && n.parentId === taskNode.id).length;
  if (shouldWarnMissingAudit(acCountForAudit, auditedAudit ?? null)) {
    ambiguityAuditWarning =
      `Considere classificar ambiguidades antes de implementar — ${acCountForAudit} ACs sem ambiguityAudit. `
      + `Submeta { specified, partial, unspecified } em start_task.`;
  }

  return {
    task: enhanced,
    context,
    ragContext,
    tddHints,
    startedAt,
    harnessWarning,
    siblingContext,
    siblingTruncatedCount,
    domainSkills,
    ambiguityAuditWarning,
    ...(memoryDynamicsTick ? { memoryDynamicsTick } : {}),
    ...(topRemediations && topRemediations.length > 0 ? { topRemediations } : {}),
    ...(leaseToken ? { leaseToken } : {}),
    ...(prefetchHit ? { prefetchHit } : {}),
    ...(checkpoint ? { checkpoint } : {}),
    ...(shadowBranch ? { shadowBranch } : {}),
    ...(modelHint ? { modelHint } : {}),
  };
}
