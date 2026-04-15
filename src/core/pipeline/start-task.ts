/**
 * Pipeline compound operation: start_task
 * Composes: next + context + context(rag) + TDD hints + update_status(in_progress)
 * Reduces 5-6 tool calls to 1.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import type { EnhancedNextResult } from "../planner/enhanced-next.js";
import type { TaskContext } from "../context/compact-context.js";
import type { AssembledContext } from "../context/context-assembler.js";
import { findEnhancedNextTask } from "../planner/enhanced-next.js";
import { buildTaskContext } from "../context/compact-context.js";
import { assembleContext } from "../context/context-assembler.js";
import { generateTddHints, generateTddHintsFromTexts } from "../implementer/tdd-checker.js";
import type { TddHint } from "../../schemas/implementer-schema.js";
import { getHarnessPreflightWarning } from "../harness/harness-preflight.js";
import type { HarnessPreflightWarning } from "../harness/harness-preflight.js";
import { runHarnessScan } from "../harness/harness-scan-runner.js";
import { evaluate as evaluateRemediations } from "../harness/remediation-engine.js";
import type { RemediationSuggestion } from "../harness/violation-detail.js";
import type { LockManager } from "../store/lock-manager.js";
import { LockConflictError } from "../utils/errors.js";
import { TaskPrefetcher } from "../planner/task-prefetcher.js";
import { createCheckpoint, type GraphCheckpoint } from "../autonomy/graph-rollback.js";
import { createShadowBranch } from "../autonomy/shadow-branch.js";
import { logger } from "../utils/logger.js";
import { now } from "../utils/time.js";

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
  /** Shadow branch name for isolated execution (Phase D — Git Transactional Layer) */
  shadowBranch?: string;
}

/**
 * Find next task (or specific nodeId), load context + RAG + TDD hints,
 * and optionally mark as in_progress — all in one call.
 */
export function startTask(
  store: SqliteStore,
  options?: StartTaskOptions,
): StartTaskResult | null {
  const { nodeId, contextDetail, ragBudget, autoStart = true, agentId, lockManager } = options ?? {};

  const doc = store.toGraphDocument();

  // 1. Find next task or lookup specific nodeId
  let enhanced: EnhancedNextResult | null;
  if (nodeId) {
    const node = doc.nodes.find((n) => n.id === nodeId);
    if (!node) {
      logger.warn("pipeline:start_task:node_not_found", { nodeId });
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
    logger.info("pipeline:start_task:no_tasks");
    return null;
  }

  const taskNode = enhanced.task.node;

  // 2. Build task context
  let context: TaskContext | null = null;
  try {
    context = buildTaskContext(store, taskNode.id);
  } catch (err) {
    logger.warn("pipeline:start_task:context_failed", { error: String(err) });
  }

  // 3. Build RAG context (check prefetcher cache first — CPU pipeline pattern)
  let ragContext: AssembledContext | null = null;
  let prefetchHit = false;
  const prefetchedData = taskPrefetcher.get(taskNode.id);
  if (prefetchedData) {
    // Prefetch hit — skip RAG assembly
    prefetchHit = true;
    logger.info("pipeline:start_task:prefetch_hit", { nodeId: taskNode.id });
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
      logger.warn("pipeline:start_task:rag_failed", { error: String(err) });
    }
  }

  // 4. Generate TDD hints from AC
  const acChildNodes = doc.nodes.filter(
    (n) => n.type === "acceptance_criteria" && n.parentId === taskNode.id,
  );
  const acTexts = [
    ...(taskNode.acceptanceCriteria ?? []),
    ...acChildNodes.map((n) => n.title),
  ];
  const tddHints = acTexts.length > 0
    ? generateTddHintsFromTexts(acTexts)
    : generateTddHints(taskNode);

  // 5. Harness pre-flight warning (non-blocking, advisory)
  let harnessWarning: HarnessPreflightWarning | null = null;
  try {
    harnessWarning = getHarnessPreflightWarning(store.getDb());
  } catch (err) {
    logger.warn("pipeline:start_task:harness_preflight_failed", { error: String(err) });
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
    logger.warn("pipeline:start_task:remediation_preflight_failed", { error: String(err) });
  }

  // 6. Auto-start if requested
  let startedAt: string | null = null;
  let leaseToken: string | undefined;
  if (autoStart) {
    try {
      if (lockManager && agentId) {
        // teamTask mode: atomic claim with lock
        const lock = lockManager.acquire(`task:${taskNode.id}`, agentId, 600); // 10min TTL
        store.updateNodeStatus(taskNode.id, "in_progress");
        leaseToken = lock.leaseToken;
        logger.info("pipeline:start_task:claimed", { nodeId: taskNode.id, agentId, leaseToken });
      } else {
        // Single-terminal mode: no lock
        store.updateNodeStatus(taskNode.id, "in_progress");
      }
      startedAt = now();
    } catch (err) {
      if (err instanceof LockConflictError) {
        logger.warn("pipeline:start_task:lock_conflict", { nodeId: taskNode.id, agentId, error: String(err) });
        throw err; // Propagate lock conflicts to caller
      }
      logger.warn("pipeline:start_task:auto_start_failed", { error: String(err) });
    }
  }

  // 6b. Create checkpoint for rollback on failure (Phase D — Autonomous Loop)
  let checkpoint: GraphCheckpoint | undefined;
  let shadowBranch: string | undefined;
  if (startedAt) {
    try {
      checkpoint = createCheckpoint(store, taskNode.id);
      logger.info("pipeline:start_task:checkpoint", { nodeId: taskNode.id, snapshotId: checkpoint.snapshotId });
    } catch (err) {
      logger.warn("pipeline:start_task:checkpoint_failed", { error: String(err) });
    }

    // 6c. Create shadow branch for isolated execution (Phase D — Git Transactional Layer)
    try {
      const branchResult = createShadowBranch(taskNode.id);
      if (branchResult.created) {
        shadowBranch = branchResult.branchName;
        logger.info("pipeline:start_task:shadow_branch", { nodeId: taskNode.id, branch: shadowBranch });
      }
    } catch (err) {
      logger.warn("pipeline:start_task:shadow_branch_failed", { error: String(err) });
    }
  }

  logger.info("pipeline:start_task:ok", {
    nodeId: taskNode.id,
    title: taskNode.title,
    autoStart,
    hasTddHints: tddHints.length > 0,
    teamTask: !!lockManager,
  });

  return {
    task: enhanced,
    context,
    ragContext,
    tddHints,
    startedAt,
    harnessWarning,
    ...(topRemediations && topRemediations.length > 0 ? { topRemediations } : {}),
    ...(leaseToken ? { leaseToken } : {}),
    ...(prefetchHit ? { prefetchHit } : {}),
    ...(checkpoint ? { checkpoint } : {}),
    ...(shadowBranch ? { shadowBranch } : {}),
  };
}
