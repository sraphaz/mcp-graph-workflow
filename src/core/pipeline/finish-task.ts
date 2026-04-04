/**
 * Pipeline compound operation: finish_task
 * Composes: DoD check + AC validation + update_status(done) + epic promotion + next
 * Reduces 3-4 tool calls to 1.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import type { ImplementDoneReport } from "../../schemas/implementer-schema.js";
import type { EnhancedNextResult } from "../planner/enhanced-next.js";
import { checkDefinitionOfDone } from "../implementer/definition-of-done.js";
import { findEnhancedNextTask } from "../planner/enhanced-next.js";
import { checkEpicPromotion } from "../utils/epic-promotion.js";
import type { EpicPromotionResult } from "../utils/epic-promotion.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { indexDecision } from "../rag/decision-indexer.js";
import { indexEntitiesForSource } from "../rag/entity-index-hook.js";
import { logger } from "../utils/logger.js";

export interface FinishTaskOptions {
  rationale?: string;
  testFiles?: string[];
  autoNext?: boolean;
}

export interface FinishTaskResult {
  dodReport: ImplementDoneReport;
  status: "done" | "blocked";
  blockers: string[];
  epicPromotion: EpicPromotionResult | null;
  nextTask: EnhancedNextResult | null;
  decisionIndexed: boolean;
}

/**
 * Validate DoD, mark task done (or blocked), check epic promotion,
 * and return next task — all in one call.
 */
export function finishTask(
  store: SqliteStore,
  nodeId: string,
  options?: FinishTaskOptions,
): FinishTaskResult {
  const { rationale, testFiles, autoNext = true } = options ?? {};
  const doc = store.toGraphDocument();

  // 0. Update testFiles if provided
  if (testFiles && testFiles.length > 0) {
    try {
      store.updateNode(nodeId, { testFiles });
    } catch (err) {
      logger.warn("pipeline:finish_task:testfiles_update_failed", { error: String(err) });
    }
  }

  // 1. Check Definition of Done (9 checks: 4 required + 5 recommended)
  const dodReport = checkDefinitionOfDone(doc, nodeId);

  // 2. Determine if task can be marked done
  const blockers = dodReport.checks
    .filter((c) => c.severity === "required" && !c.passed)
    .map((c) => `${c.name}: ${c.details}`);

  let status: "done" | "blocked";
  if (blockers.length === 0) {
    // All required checks pass — mark done
    try {
      store.updateNodeStatus(nodeId, "done");
      status = "done";
    } catch (err) {
      logger.warn("pipeline:finish_task:status_update_failed", { error: String(err) });
      status = "blocked";
      blockers.push(`Status update failed: ${String(err)}`);
    }
  } else {
    status = "blocked";
    logger.info("pipeline:finish_task:blocked", { nodeId, blockers: blockers.length });
  }

  // 3. Index rationale as AI decision (if done + rationale provided)
  let decisionIndexed = false;
  if (status === "done" && rationale) {
    try {
      const node = store.getNodeById(nodeId);
      const knowledgeStore = new KnowledgeStore(store.getDb());
      indexDecision(knowledgeStore, {
        nodeId,
        title: node?.title ?? nodeId,
        rationale,
        tags: node?.tags ?? [],
      });
      indexEntitiesForSource(store.getDb(), "ai_decision");
      decisionIndexed = true;
    } catch (err) {
      logger.warn("pipeline:finish_task:decision_index_failed", { error: String(err) });
    }
  }

  // 4. Check epic promotion
  let epicPromotion: EpicPromotionResult | null = null;
  if (status === "done") {
    epicPromotion = checkEpicPromotion(store, nodeId);
  }

  // 5. Find next task if requested
  let nextTask: EnhancedNextResult | null = null;
  if (autoNext && status === "done") {
    const freshDoc = store.toGraphDocument();
    nextTask = findEnhancedNextTask(freshDoc, store);
  }

  logger.info("pipeline:finish_task:ok", {
    nodeId,
    status,
    dodScore: dodReport.score,
    dodGrade: dodReport.grade,
    blockers: blockers.length,
    hasNext: nextTask !== null,
  });

  return {
    dodReport,
    status,
    blockers,
    epicPromotion,
    nextTask,
    decisionIndexed,
  };
}
