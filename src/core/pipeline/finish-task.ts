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
import { checkEpicPromotion, autoPromoteEpic, cascadeDownOnDone } from "../utils/epic-promotion.js";
import type { EpicPromotionResult, AutoPromoteResult, CascadeDownResult } from "../utils/epic-promotion.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { indexDecision } from "../rag/decision-indexer.js";
import { indexEntitiesForSource } from "../rag/entity-index-hook.js";
import { IssuePatternTracker } from "../harness/issue-pattern-tracker.js";
import type { RuleSuggestion } from "../harness/issue-pattern-tracker.js";
import { getHarnessRegressionReport } from "../harness/harness-preflight.js";
import type { HarnessRegressionReport } from "../harness/harness-preflight.js";
import { runHarnessScan } from "../harness/harness-scan-runner.js";
import { RemediationValidator, type PostFixResult } from "../harness/remediation-validator.js";
import { logger } from "../utils/logger.js";

// Maps DoD check names to IssuePatternTracker pattern types
const DOD_CHECK_TO_PATTERN: Record<string, string> = {
  has_acceptance_criteria: "missing_ac",
  status_flow_valid: "status_skip",
  has_description: "missing_description",
  not_oversized: "oversized_task",
  has_estimate: "missing_estimate",
};

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
  autoPromoted: string[];
  cascadedDown: string[];
  nextTask: EnhancedNextResult | null;
  decisionIndexed: boolean;
  harnessRegression: HarnessRegressionReport | null;
  ruleSuggestions: RuleSuggestion[];
  /** Post-fix remediation validation — present when pre-fix snapshot exists */
  remediationValidation?: PostFixResult | null;
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

  // 2.5 — Harness steering loop: record failed DoD checks as issue patterns (non-blocking)
  let ruleSuggestions: RuleSuggestion[] = [];
  try {
    const tracker = new IssuePatternTracker(store.getDb());
    for (const check of dodReport.checks) {
      if (!check.passed) {
        const patternType = DOD_CHECK_TO_PATTERN[check.name];
        if (patternType) {
          tracker.recordIssue(patternType, nodeId);
        }
      }
    }
    ruleSuggestions = tracker.getSuggestedRules();
  } catch (err) {
    logger.warn("pipeline:finish_task:issue_tracker_failed", { error: String(err) });
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

  // 4. Check epic promotion + auto-cascade
  let epicPromotion: EpicPromotionResult | null = null;
  let autoPromoted: AutoPromoteResult = { promoted: [] };
  let cascadedDown: CascadeDownResult = { cascaded: [] };
  if (status === "done") {
    epicPromotion = checkEpicPromotion(store, nodeId);
    cascadedDown = cascadeDownOnDone(store, nodeId);
    autoPromoted = autoPromoteEpic(store, nodeId);
  }

  // 5. Find next task if requested
  let nextTask: EnhancedNextResult | null = null;
  if (autoNext && status === "done") {
    const freshDoc = store.toGraphDocument();
    nextTask = findEnhancedNextTask(freshDoc, store);
  }

  // 6. Harness regression check (non-blocking, advisory)
  let harnessRegression: HarnessRegressionReport | null = null;
  if (status === "done") {
    try {
      const scanResult = runHarnessScan(process.cwd(), store.getDb());
      harnessRegression = getHarnessRegressionReport(store.getDb(), scanResult.score);
    } catch (err) {
      logger.warn("pipeline:finish_task:harness_regression_failed", { error: String(err) });
    }
  }

  // 7. Remediation post-fix validation (non-blocking)
  let remediationValidation: PostFixResult | null = null;
  if (status === "done") {
    try {
      const preFixSnapshotId = store.getProjectSetting("harness_prefix_snapshot");
      if (preFixSnapshotId) {
        const scanWithViolations = runHarnessScan(process.cwd(), store.getDb(), undefined, { collectViolations: true });
        if (scanWithViolations.violations) {
          const validator = new RemediationValidator(store.getDb());
          // Re-record pre-fix state from stored snapshot data
          const preFixData = store.getProjectSetting("harness_prefix_violations");
          if (preFixData) {
            const preFixViolations = JSON.parse(preFixData);
            const sid = validator.recordPreFixState(preFixViolations);
            remediationValidation = validator.validatePostFix(sid, scanWithViolations.violations);
          }
        }
        // Clear snapshot after validation
        store.setProjectSetting("harness_prefix_snapshot", "");
        store.setProjectSetting("harness_prefix_violations", "");
      }
    } catch (err) {
      logger.warn("pipeline:finish_task:remediation_validation_failed", { error: String(err) });
    }
  }

  logger.info("pipeline:finish_task:ok", {
    nodeId,
    status,
    dodScore: dodReport.score,
    dodGrade: dodReport.grade,
    blockers: blockers.length,
    hasNext: nextTask !== null,
    harnessRegression: harnessRegression !== null,
  });

  return {
    dodReport,
    status,
    blockers,
    epicPromotion,
    autoPromoted: autoPromoted.promoted,
    cascadedDown: cascadedDown.cascaded,
    nextTask,
    decisionIndexed,
    harnessRegression,
    ruleSuggestions,
    ...(remediationValidation ? { remediationValidation } : {}),
  };
}
