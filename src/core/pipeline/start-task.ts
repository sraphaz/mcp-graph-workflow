/**
 * Pipeline compound operation: start_task
 * Composes: next + context + rag_context + TDD hints + update_status(in_progress)
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
import { logger } from "../utils/logger.js";
import { now } from "../utils/time.js";

export interface StartTaskOptions {
  nodeId?: string;
  contextDetail?: "summary" | "standard" | "deep";
  ragBudget?: number;
  autoStart?: boolean;
}

export interface StartTaskResult {
  task: EnhancedNextResult;
  context: TaskContext | null;
  ragContext: AssembledContext | null;
  tddHints: TddHint[];
  startedAt: string | null;
}

/**
 * Find next task (or specific nodeId), load context + RAG + TDD hints,
 * and optionally mark as in_progress — all in one call.
 */
export function startTask(
  store: SqliteStore,
  options?: StartTaskOptions,
): StartTaskResult | null {
  const { nodeId, contextDetail, ragBudget, autoStart = true } = options ?? {};

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
    enhanced = findEnhancedNextTask(doc, store);
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

  // 3. Build RAG context
  let ragContext: AssembledContext | null = null;
  try {
    ragContext = assembleContext(store, taskNode.title, {
      tokenBudget: ragBudget ?? 4000,
      tier: contextDetail ?? "standard",
    });
  } catch (err) {
    logger.warn("pipeline:start_task:rag_failed", { error: String(err) });
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

  // 5. Auto-start if requested
  let startedAt: string | null = null;
  if (autoStart) {
    try {
      store.updateNodeStatus(taskNode.id, "in_progress");
      startedAt = now();
    } catch (err) {
      logger.warn("pipeline:start_task:auto_start_failed", { error: String(err) });
    }
  }

  logger.info("pipeline:start_task:ok", {
    nodeId: taskNode.id,
    title: taskNode.title,
    autoStart,
    hasTddHints: tddHints.length > 0,
  });

  return {
    task: enhanced,
    context,
    ragContext,
    tddHints,
    startedAt,
  };
}
