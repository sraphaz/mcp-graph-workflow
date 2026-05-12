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
 * Pipeline compound operation: finish_task
 * Composes: DoD check + AC validation + update_status(done) + epic promotion + next
 * Reduces 3-4 tool calls to 1.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { proposeBrowserSkillFromNode } from "../skills/browser-skill-proposer.js";
import type { ImplementDoneReport } from "../../schemas/implementer-schema.js";
import type { EnhancedNextResult } from "../planner/enhanced-next.js";
import { checkDefinitionOfDone } from "../implementer/definition-of-done.js";
import { getSharedHookBus } from "../hooks/shared-hook-bus.js";
import { findEnhancedNextTask } from "../planner/enhanced-next.js";
import { checkEpicPromotion, autoPromoteEpic, cascadeDownOnDone } from "../utils/epic-promotion.js";
import type { EpicPromotionResult, AutoPromoteResult, CascadeDownResult } from "../utils/epic-promotion.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { indexDecision } from "../rag/decision-indexer.js";
import { indexEntitiesForSource } from "../rag/entity-index-hook.js";
import { IssuePatternTracker } from "../harness/issue-pattern-tracker.js";
import type { RuleSuggestion } from "../harness/issue-pattern-tracker.js";
import { getHarnessRegressionReport, checkHarnessRegressionGate } from "../harness/harness-preflight.js";
import type { HarnessRegressionReport, HarnessGateResult } from "../harness/harness-preflight.js";
import { runHarnessScan } from "../harness/harness-scan-runner.js";
import { RemediationValidator, type PostFixResult } from "../harness/remediation-validator.js";
import { validateFiles } from "../harness/contract-engine.js";
import { runTestGate, type TestGateResult, type TestGateMode } from "../harness/test-gate.js";
import { checkInvariants, getBuiltInInvariants, type InvariantResult } from "../harness/property-invariants.js";
import { discoverTestFiles } from "../harness/test-discovery.js";
import { runSyntheticValidation, type SyntheticValidationResult } from "../harness/synthetic-validation-gate.js";
// feature-depth module retired (removed in #385); keep minimal type for result shape compat.
type FeatureDepthReport = { blockers: string[]; warnings: string[] } | null;
import { analyzeTrajectory } from "../skills/trajectory-analyzer.js";
import { proposeSkillFromTrajectory, type SkillProposal } from "../skills/auto-skill-proposer.js";
import { mergeShadowBranch, discardShadowBranch } from "../autonomy/shadow-branch.js";
import { SubtaskArtifactsStore, type ArtifactKind } from "../store/subtask-artifacts-store.js";
import type { LockManager } from "../store/lock-manager.js";
import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { LockConflictError, InvalidArgumentError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import { runSentruxAdvisoryCheck } from "./sentrux-advisory-check.js";
import { SentruxMcpAdapter } from "../integrations/sentrux-mcp-adapter.js";

const log = createLogger({ layer: "core", source: "finish-task.ts" });

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
  /** RAG citations that informed the decision */
  citations?: import("../rag/citation-chain.js").CitationRef[];
  /** Agent ID for teamTask mode — verifies task ownership */
  agentId?: string;
  /** Lease token for releasing the task lock (teamTask mode) */
  leaseToken?: string;
  /** LockManager instance for teamTask mode */
  lockManager?: LockManager;
  /** Shadow branch name from start_task (Phase D — Git Transactional Layer) */
  shadowBranch?: string;
  /**
   * v11 Context-Pollination: structured outputs to persist in subtask_artifacts.
   * Optional — when omitted, behavior is identical to v10 (artifactIds = []).
   */
  artifacts?: Array<{
    kind: ArtifactKind;
    path?: string | null;
    content: string;
  }>;
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
  /** Regression gate result — present when a baseline was stored at start_task */
  harnessGate?: HarnessGateResult | null;
  ruleSuggestions: RuleSuggestion[];
  /** Post-fix remediation validation — present when pre-fix snapshot exists */
  remediationValidation?: PostFixResult | null;
  /** Contract validation gate result — Design by Contract (Meyer 1986) */
  contractGate?: ContractGateResult | null;
  /** Test gate result — Closed-Loop TDD (Wiener 1948) + DORA Shift-Left */
  testGate?: TestGateResult | null;
  /** Property-based invariant check result */
  invariantResult?: InvariantResult | null;
  /** Test files auto-discovered by title keyword matching */
  discoveredTestFiles?: string[];
  /** Synthetic mutation validation result (advisory) */
  syntheticValidation?: SyntheticValidationResult | null;
  /**
   * Feature-depth per-file check — present when the node carries
   * touchedFiles metadata. Advisory by default: regressions appear in
   * `featureDepth.warnings` (not in `blockers`). Upward quadrant
   * crossings auto-emit memory entries as a side effect.
   */
  featureDepth?: FeatureDepthReport | null;
  /**
   * v11 Context-Pollination: ids dos artifacts persistidos nesta chamada.
   * Sempre presente; [] quando options.artifacts vazio/ausente ou dedup resultou em zero novos.
   * Dedup retorna o id existente (pode aparecer uma vez aqui por entry mesmo sendo dup).
   */
  artifactIds: string[];
  /**
   * Auto-generated skill proposal — populated when the trajectory analyzer
   * detects a heuristic trigger (≥2× retries, ADR mention, or "discovered"
   * in the rationale). The draft is in-memory only — never written to disk.
   * Caller decides whether to persist as a real skill.
   */
  skillProposal?: SkillProposal | null;
  /** Sentrux advisory check result — present when a session_end was triggered (advisory; never blocks) */
  sentruxAdvisory?: { warned: boolean; message?: string } | null;
}

export interface ContractGateResult {
  mode: "strict" | "advisory" | "off";
  violationCount: number;
  errorCount: number;
  warningCount: number;
  violations: Array<{ ruleId: string; file: string; line: number; message: string; severity: string }>;
  blocked: boolean;
}

/**
 * Validate DoD, mark task done (or blocked), check epic promotion,
 * and return next task — all in one call.
 */
export async function finishTask(
  store: SqliteStore,
  nodeId: string,
  options?: FinishTaskOptions,
): Promise<FinishTaskResult> {
  if (!nodeId) throw new InvalidArgumentError("finishTask requires a nodeId");
  const { rationale, testFiles, autoNext = true, citations, agentId, leaseToken, lockManager, shadowBranch, artifacts } = options ?? {};
  const doc = store.toGraphDocument();

  // 0. Update testFiles if provided
  if (testFiles && testFiles.length > 0) {
    try {
      store.updateNode(nodeId, { testFiles });
    } catch (err) {
      log.warn("pipeline:finish_task:testfiles_update_failed", { error: String(err) });
    }
  }

  // 0b. Auto-discover test files if node has none
  let discoveredTestFiles: string[] = [];
  {
    const node = store.getNodeById(nodeId);
    if (node && (!node.testFiles || node.testFiles.length === 0)) {
      try {
        discoveredTestFiles = discoverTestFiles(node.title, process.cwd());
        if (discoveredTestFiles.length > 0) {
          store.updateNode(nodeId, { testFiles: discoveredTestFiles });
          log.info("pipeline:finish_task:test_discovery", { nodeId, found: discoveredTestFiles.length });
        }
      } catch (err) {
        log.warn("pipeline:finish_task:test_discovery_failed", { error: String(err) });
      }
    }
  }

  // 0c. Persist v11 artifacts (ADR-0049 — optional, backward-compatible)
  const artifactIds: string[] = [];
  if (artifacts && artifacts.length > 0) {
    try {
      const node = store.getNodeById(nodeId);
      // epic_id = first ancestor epic (derived from parentId chain); fallback to parentId or nodeId
      const epicId = node?.parentId ?? nodeId;
      const artifactsStore = new SubtaskArtifactsStore(store);
      for (const aVar of artifacts) {
        const id = artifactsStore.insert({
          nodeId,
          epicId,
          kind: aVar.kind,
          path: aVar.path ?? null,
          content: aVar.content,
        });
        artifactIds.push(id);
      }
      log.info("pipeline:finish_task:artifacts_persisted", {
        nodeId,
        count: artifactIds.length,
      });
    } catch (err) {
      log.warn("pipeline:finish_task:artifacts_persist_failed", {
        error: String(err),
      });
    }
  }

  // 1. Check Definition of Done (9 checks: 4 required + 5 recommended)
  const dodReport = checkDefinitionOfDone(doc, nodeId);

  // 1.5. Contract validation gate (Design by Contract — Meyer 1986, Closed-Loop — Wiener 1948)
  let contractGate: ContractGateResult | null = null;
  try {
    // Run contract validation on project files (advisory mode by default)
    const contractMode = (store.getProjectSetting("contract_gate_mode") ?? "advisory") as "strict" | "advisory" | "off";
    if (contractMode !== "off") {
      const cwd = process.cwd();
      const srcDir = join(cwd, "src");

      if (existsSync(srcDir)) {
        // Scan only recently modified .ts files (last 10 minutes) to keep it fast
        const files: Array<{ path: string; content: string }> = [];
        const cutoff = Date.now() - 10 * 60 * 1000;

        const scanDir = (dir: string): void => {
          try {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = join(dir, entry.name);
              if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
                scanDir(fullPath);
              } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
                try {
                  const stat = statSync(fullPath);
                  if (stat.mtimeMs > cutoff) {
                    const content = readFileSync(fullPath, "utf-8");
                    const relativePath = relative(cwd, fullPath);
                    files.push({ path: relativePath, content });
                  }
                } catch (err) {
                  log.debug("intentional-swallow", { error: String(err), reason: "skip unreadable files" });
                }
              }
            }
          } catch (err) {
            log.debug("intentional-swallow", { error: String(err), reason: "skip unreadable dirs" });
          }
        };

        scanDir(srcDir);

        if (files.length > 0) {
          const resultValue = validateFiles(files);
          const errors = resultValue.violations.filter((v) => v.severity === "error");
          const warnings = resultValue.violations.filter((v) => v.severity === "warning");

          contractGate = {
            mode: contractMode,
            violationCount: resultValue.violationCount,
            errorCount: errors.length,
            warningCount: warnings.length,
            violations: resultValue.violations.slice(0, 20), // limit to 20 to avoid bloat
            blocked: contractMode === "strict" && errors.length > 0,
          };
        } else {
          contractGate = {
            mode: contractMode,
            violationCount: 0,
            errorCount: 0,
            warningCount: 0,
            violations: [],
            blocked: false,
          };
        }
      } else {
        contractGate = { mode: contractMode, violationCount: 0, errorCount: 0, warningCount: 0, violations: [], blocked: false };
      }
    }
  } catch (err) {
    log.warn("pipeline:finish_task:contract_gate_failed", { error: String(err) });
    contractGate = { mode: "advisory", violationCount: 0, errorCount: 0, warningCount: 0, violations: [], blocked: false };
  }

  // 1.6. Property-based invariant check (advisory — never blocks)
  let invariantResult: InvariantResult | null = null;
  try {
    invariantResult = checkInvariants(doc, getBuiltInInvariants());
    if (!invariantResult.passed) {
      log.warn("pipeline:finish_task:invariant_violations", {
        nodeId,
        violations: invariantResult.violations.length,
        invariants: [...new Set(invariantResult.violations.map((v: { invariantId?: string; rule?: string }) => v.invariantId ?? v.rule ?? "unknown"))],
      });
    }
  } catch (err) {
    log.warn("pipeline:finish_task:invariant_check_failed", { error: String(err) });
  }

  // 2. Determine if task can be marked done
  const blockers = (dodReport?.checks ?? [])
    .filter((c) => c?.severity === "required" && !c?.passed)
    .map((c) => `${c?.name ?? "unknown"}: ${c?.details ?? "no details"}`);

  // B31 (node_423b60dc9dbc): if the node doesn't exist, dodReport returns
  // grade F with an empty checks array — the filter above produces zero
  // blockers, so status would silently become "done" on a non-existent
  // node. Surface it as a blocker so the response is status:"blocked".
  const nodeMissing =
    !doc.nodes.some((n) => n.id === nodeId) ||
    (dodReport.grade === "F" && (dodReport.checks?.length ?? 0) === 0);
  if (nodeMissing) {
    blockers.push(`node_not_found: ${dodReport.summary ?? `Node "${nodeId}" not found`}`);
  }

  // 2.0a. Add contract gate blockers (strict mode only)
  if (contractGate?.blocked) {
    blockers.push(`contract_gate: ${contractGate.errorCount} architecture violation(s) found`);
  }

  // 2.0b. Test gate — Closed-Loop TDD (Wiener 1948) + DORA Shift-Left
  let testGate: TestGateResult | null = null;
  try {
    const testGateMode = (store.getProjectSetting("test_gate_mode") ?? "advisory") as TestGateMode;
    testGate = await runTestGate(store, nodeId, testGateMode);
    if (testGate.blocked) {
      blockers.push(`test_gate: ${testGate.failed} test(s) failed — fix before marking done`);
    }
  } catch (err) {
    log.warn("pipeline:finish_task:test_gate_failed", { error: String(err) });
  }

  // 2.0c. Feature-depth check — per-file regression gate + quadrant
  // crossing → memory writes. Advisory: warnings surface in the
  // result but never push to `blockers`. UPSERTs the new baseline
  // for every touched file as a side effect (best-effort, errors
  // are swallowed by the DAO so a baselines issue never blocks the
  // task). See src/core/feature-depth/finish-task-integration.ts.
  // feature-depth check retired (module removed in #385) — always null.
  const featureDepthReport: FeatureDepthReport = null;

  // 2a. Verify task ownership in teamTask mode
  if (lockManager && agentId) {
    const lockInfo = lockManager.isHeldByOther(`task:${nodeId}`, agentId);
    if (lockInfo) {
      throw new LockConflictError({
        resourceId: `task:${nodeId}`,
        owner: lockInfo.agentId,
        acquiredAt: lockInfo.acquiredAt,
        expiresAt: lockInfo.expiresAt,
      });
    }
  }

  let status: "done" | "blocked";
  if (blockers.length === 0) {
    // All required checks pass — mark done
    try {
      store.updateNodeStatus(nodeId, "done");
      status = "done";

      // §extracta-wire-followups — auto-write a browser skill when the
      // node carries metadata.browserSkillInput AND the env gate is on.
      // Failures are logged but never block finish_task.
      try {
        const node = store.getNodeById(nodeId);
        const outcome = proposeBrowserSkillFromNode(node);
        if (outcome.written) {
          log.info("pipeline:finish_task:browser_skill_written", { nodeId, path: outcome.path });
        }
      } catch (err) {
        log.warn("pipeline:finish_task:browser_skill_failed", { nodeId, error: String(err) });
      }

      // Release task lock in teamTask mode
      if (lockManager && leaseToken) {
        try {
          lockManager.release(leaseToken);
          log.info("pipeline:finish_task:lock_released", { nodeId, leaseToken });
        } catch (err) {
          log.warn("pipeline:finish_task:lock_release_failed", { nodeId, error: String(err) });
        }
      }

      // Release file locks stored in metadata._fileLeases (Commit G)
      if (lockManager) {
        try {
          const node = store.getNodeById(nodeId);
          const fileLeases = (node?.metadata as Record<string, unknown> | undefined)?._fileLeases;
          if (Array.isArray(fileLeases)) {
            for (const token of fileLeases) {
              try {
                lockManager.release(String(token));
              } catch (err) {
                log.debug("intentional-swallow", { error: String(err), reason: "stale or already-released token — ignore" });
              }
            }
            log.info("pipeline:finish_task:file_leases_released", { nodeId, count: fileLeases.length });
          }
        } catch (err) {
          log.warn("pipeline:finish_task:file_leases_release_failed", { nodeId, error: String(err) });
        }
      }

      // Harvest touched files from git diff (Commit G)
      try {
        const raw = execSync("git diff --name-only HEAD~1 HEAD", {
          cwd: process.cwd(),
          timeout: 5000,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        const touchedFilesObserved = raw
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean);
        const existing = store.getNodeById(nodeId);
        store.updateNode(nodeId, {
          metadata: { ...(existing?.metadata as Record<string, unknown> ?? {}), touchedFilesObserved },
        });
        log.info("pipeline:finish_task:touched_files_harvested", { nodeId, count: touchedFilesObserved.length });
      } catch (err) {
        log.debug("intentional-swallow", { error: String(err), reason: "git not available or no commits yet — store empty array" });
        try {
          const existing = store.getNodeById(nodeId);
          store.updateNode(nodeId, {
            metadata: { ...(existing?.metadata as Record<string, unknown> ?? {}), touchedFilesObserved: [] },
          });
        } catch (err2) {
          log.debug("intentional-swallow", { error: String(err2), reason: "non-fatal — store update failed" });
        }
      }
    } catch (err) {
      log.warn("pipeline:finish_task:status_update_failed", { error: String(err) });
      status = "blocked";
      blockers.push(`Status update failed: ${String(err)}`);
    }
  } else {
    status = "blocked";
    log.info("pipeline:finish_task:blocked", { nodeId, blockers: blockers.length });
  }

  // 2.3a. Emit pipeline hook for completion / failure (Sprint 1 — wiring)
  if (status === "done") {
    void getSharedHookBus().emit({
      channel: "task:post-complete",
      timestamp: new Date().toISOString(),
      payload: { nodeId, ...(agentId ? { agentId } : {}) },
    });
  } else {
    void getSharedHookBus().emit({
      channel: "task:error",
      timestamp: new Date().toISOString(),
      payload: {
        nodeId,
        phase: "finish_task",
        error: blockers.join("; ") || "blocked",
        ...(agentId ? { agentId } : {}),
      },
    });
  }

  // 2.3b. Recovery orchestrator: record failure for MTTR-A tracking (Phase C+D)
  if (status === "blocked") {
    try {
      const { RecoveryOrchestrator } = await import("../autonomy/recovery-orchestrator.js");
      const recovery = new RecoveryOrchestrator(store, { maxRetries: 3 });
      recovery.beginTask(nodeId);
      const recoveryResult = recovery.failTask(nodeId, blockers.join("; "));
      log.info("pipeline:finish_task:recovery_recorded", {
        nodeId, attempt: recoveryResult.attempt, canRetry: recoveryResult.canRetry,
        escalate: recoveryResult.escalate, mttrMs: recoveryResult.mttrMs,
      });
    } catch (err) {
      log.warn("pipeline:finish_task:recovery_failed", { error: String(err) });
    }
  }

  // 2.4. Shadow branch resolution (Phase D — Git Transactional Layer)
  if (shadowBranch) {
    try {
      if (status === "done") {
        const mergeResult = mergeShadowBranch(shadowBranch, "HEAD");
        log.info("pipeline:finish_task:shadow_merged", { shadowBranch, merged: mergeResult.merged });
      } else {
        const discardResult = discardShadowBranch(shadowBranch, "HEAD");
        log.info("pipeline:finish_task:shadow_discarded", { shadowBranch, discarded: discardResult.discarded });
      }
    } catch (err) {
      log.warn("pipeline:finish_task:shadow_branch_failed", { shadowBranch, error: String(err) });
    }
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
    log.warn("pipeline:finish_task:issue_tracker_failed", { error: String(err) });
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
        ...(citations && citations.length > 0 ? { citations } : {}),
      });
      indexEntitiesForSource(store.getDb(), "ai_decision");

      // Create provenance record linking decision to citations
      if (citations && citations.length > 0) {
        try {
          const { createProvenance } = await import("../rag/decision-provenance.js");
          createProvenance(knowledgeStore, {
            nodeId,
            rationale,
            citations,
            timestamp: new Date().toISOString(),
          });
        } catch (provErr) {
          log.warn("pipeline:finish_task:provenance_failed", { error: String(provErr) });
        }
      }

      decisionIndexed = true;
    } catch (err) {
      log.warn("pipeline:finish_task:decision_index_failed", { error: String(err) });
    }
  }

  // 3a-success. Strategy-based experiential memory (paper §4.2.2 + §5.1.2).
  //     When ≥3 grade-A finishes share a pattern key (tag set or parent
  //     epic), distill a strategy_<key>_<date>.md memory. Mirrors the
  //     existing failure-side IssuePatternTracker for symmetry.
  if (status === "done" && rationale && dodReport.grade === "A" && (testGate?.status ?? "skipped") === "passed") {
    try {
      const node = store.getNodeById(nodeId);
      if (node) {
        const { SuccessPatternTracker, derivePatternKey, buildStrategyMemory } = await import("../harness/success-pattern-tracker.js");
        const tracker = new SuccessPatternTracker(store.getDb());
        const patternKey = derivePatternKey(node);
        const resultValue = tracker.recordSuccess(patternKey, nodeId, rationale);
        if (resultValue.shouldEmit && resultValue.patternKey) {
          const payload = buildStrategyMemory({
            patternKey: resultValue.patternKey,
            nodeIds: resultValue.contributingNodeIds,
            rationales: resultValue.contributingRationales,
          });
          const { writeMemory } = await import("../memory/memory-reader.js");
          await writeMemory(process.cwd(), payload.name, payload.content);
          log.info("pipeline:finish_task:strategy_memory_written", { nodeId, name: payload.name, patternKey: resultValue.patternKey, count: resultValue.count });
        }
      }
    } catch (err) {
      log.warn("pipeline:finish_task:strategy_memory_failed", { error: String(err) });
    }
  }

  // 3a. Case-based experiential memory distillation (paper §4.2.1 + §5.1.1
  //     — Hu et al. 2026). On grade-A finish with non-trivial rationale and
  //     observed test files, write a case_<nodeId>_<date>.md memory so the
  //     next similar task can replay the working approach.
  if (status === "done" && rationale) {
    try {
      const node = store.getNodeById(nodeId);
      const observedTestFiles = Array.from(new Set([
        ...(testFiles ?? []),
        ...(discoveredTestFiles ?? []),
      ]));
      if (node) {
        const { buildCaseMemory } = await import("../memory/case-distillation.js");
        const caseResult = buildCaseMemory({
          node,
          grade: dodReport.grade,
          rationale,
          testFiles: observedTestFiles,
        });
        if (caseResult.shouldWrite && caseResult.name && caseResult.content) {
          const { writeMemory } = await import("../memory/memory-reader.js");
          await writeMemory(process.cwd(), caseResult.name, caseResult.content);
          log.info("pipeline:finish_task:case_memory_written", { nodeId, name: caseResult.name });
        } else {
          log.debug("pipeline:finish_task:case_memory_skipped", { nodeId, reason: caseResult.reason });
        }
      }
    } catch (err) {
      log.warn("pipeline:finish_task:case_memory_failed", { error: String(err) });
    }
  }

  // 3b. RAG-citation → quality feedback loop (paper §7.3 — Hu et al. 2026).
  //     Derive a signal from DoD grade + test gate, apply to every docId
  //     start_task surfaced. Closes the loop the survey calls out as the
  //     standing open problem in agent-memory dynamics.
  if (status === "done") {
    try {
      const taskNode = store.getNodeById(nodeId);
      const meta = taskNode?.metadata as Record<string, unknown> | undefined;
      const ragOffered = Array.isArray(meta?.ragOffered) ? (meta.ragOffered as string[]) : [];
      if (ragOffered.length > 0) {
        const { applyRagFeedback, deriveFeedbackSignal } = await import("../rag/rag-feedback.js");
        const signal = deriveFeedbackSignal(
          dodReport.grade,
          (testGate?.status ?? "skipped") as "passed" | "failed" | "skipped" | "blocked",
          testGate?.failed ?? 0,
        );
        const resultValue = applyRagFeedback(store.getDb(), ragOffered, signal, taskNode?.title ?? nodeId);
        log.info("pipeline:finish_task:rag_feedback_applied", {
          nodeId,
          signal,
          ...resultValue,
        });
      }
    } catch (err) {
      log.warn("pipeline:finish_task:rag_feedback_failed", { error: String(err) });
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

    // 5.1 Feed prefetcher with predicted next task context (CPU pipeline pattern)
    if (nextTask?.task?.node?.id) {
      try {
        const { taskPrefetcher } = await import("./start-task.js");
        const { assembleContext } = await import("../context/context-assembler.js");
        const nextRag = assembleContext(store, nextTask.task.node.title ?? "", { tokenBudget: 4000, tier: "standard" });
        taskPrefetcher.prefetch(nextTask.task.node.id, {
          query: nextTask.task.node.title ?? "",
          context: JSON.stringify(nextRag),
        });
        log.debug("pipeline:finish_task:prefetch_fed", { nextNodeId: nextTask.task.node.id });
      } catch (err) {
        log.debug("pipeline:finish_task:prefetch_feed_failed", { error: String(err) });
      }
    }
  }

  // 6. Harness regression check + regression gate
  let harnessRegression: HarnessRegressionReport | null = null;
  let harnessGate: HarnessGateResult | null = null;
  if (status === "done") {
    try {
      const scanResult = runHarnessScan(process.cwd(), store.getDb());
      harnessRegression = getHarnessRegressionReport(store.getDb(), scanResult.score);

      // Regression gate: compare against baseline captured at start_task
      const taskNode = store.getNodeById(nodeId);
      const meta = taskNode?.metadata as Record<string, unknown> | undefined;
      const baselineScore = typeof meta?._harnessBaseline === "number" ? meta._harnessBaseline : null;
      if (baselineScore !== null) {
        const gateMode = (store.getProjectSetting("harness_gate_mode") ?? "advisory") as "strict" | "advisory" | "off";
        const overrideReason = typeof meta?._harnessOverrideReason === "string" ? meta._harnessOverrideReason : undefined;
        harnessGate = checkHarnessRegressionGate(baselineScore, scanResult.score, gateMode, 5, overrideReason);
        if (harnessGate.blocked) {
          log.warn("pipeline:finish_task:harness_gate_blocked", {
            nodeId,
            startScore: baselineScore,
            endScore: scanResult.score,
            delta: harnessGate.delta,
            mode: gateMode,
          });
          // §harness-savings (Eduardo) — every block writes a real-metrics row
          // so the graph can quantify avoided cost. Best-effort; never throws.
          try {
            const { recordBlock, getSessionTokensConsumed, getBaselineContinuation } = await import(
              "../harness/savings-ledger.js"
            );
            const db = store.getDb();
            const project = store.getActiveProject();
            const projectId = project?.id ?? "default";
            const sessionId = agentId;
            const tokensConsumed = sessionId ? getSessionTokensConsumed(db, sessionId) : 0;
            const baseline = getBaselineContinuation(db, "harness_regression_gate");
            recordBlock(db, {
              projectId,
              blockType: "harness_regression_gate",
              blockerModule: "finish_task",
              nodeId,
              sessionId,
              tokensConsumed,
              baselineContinuation: baseline.avg,
              baselineN: baseline.n,
              evidence: {
                startScore: baselineScore,
                endScore: scanResult.score,
                delta: harnessGate.delta,
                mode: gateMode,
              },
            });
          } catch (err) {
            log.warn("pipeline:finish_task:savings_record_failed", { error: String(err) });
          }
        } else if (harnessGate.delta < -5) {
          log.warn("pipeline:finish_task:harness_gate_advisory", {
            nodeId,
            startScore: baselineScore,
            endScore: scanResult.score,
            delta: harnessGate.delta,
          });
        }
      }
    } catch (err) {
      log.warn("pipeline:finish_task:harness_regression_failed", { error: String(err) });
    }
  }

  // 6b. Synthetic mutation validation (advisory — DeMillo 1978)
  let syntheticValidation: SyntheticValidationResult | null = null;
  if (status === "done") {
    try {
      syntheticValidation = runSyntheticValidation(store);
      if (syntheticValidation && !syntheticValidation.passed) {
        log.warn("pipeline:finish_task:synthetic_validation_low", {
          nodeId,
          score: syntheticValidation.score,
          caught: syntheticValidation.mutationsCaught,
          applied: syntheticValidation.mutationsApplied,
        });
      }
    } catch (err) {
      log.warn("pipeline:finish_task:synthetic_validation_failed", { error: String(err) });
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
            try {
              const preFixViolations = JSON.parse(preFixData);
              const sid = validator.recordPreFixState(preFixViolations);
              remediationValidation = validator.validatePostFix(sid, scanWithViolations.violations);
            } catch {
              log.warn("finish-task:corrupted-prefix-violations", { preFixData: preFixData.slice(0, 100) });
            }
          }
        }
        // Clear snapshot after validation
        store.setProjectSetting("harness_prefix_snapshot", "");
        store.setProjectSetting("harness_prefix_violations", "");
      }
    } catch (err) {
      log.warn("pipeline:finish_task:remediation_validation_failed", { error: String(err) });
    }
  }

  // 8. Auto-skill proposer — trajectory heuristics → draft markdown for human review.
  // Never writes to disk. Triggered when reasons.length > 0 (retries / adr / discovered).
  let skillProposal: SkillProposal | null = null;
  if (status === "done" && rationale) {
    try {
      const node = store.getNodeById(nodeId);
      const startedAtRaw = (node?.metadata as Record<string, unknown> | undefined)?._taskStartedAt;
      const startedAt = typeof startedAtRaw === "string" ? Date.parse(startedAtRaw) : Number(startedAtRaw ?? 0);
      const cycleTimeMs = startedAt > 0 ? Date.now() - startedAt : 0;
      const adrCreated = /\bADR-\d+\b/i.test(rationale);

      const trajectory = analyzeTrajectory({
        cycleTimeMs,
        estimateMinutes: node?.estimateMinutes ?? 0,
        adrCreated,
        summary: rationale,
      });

      if (trajectory.shouldPropose) {
        skillProposal = proposeSkillFromTrajectory({
          taskId: nodeId,
          taskTitle: node?.title ?? nodeId,
          taskDescription: node?.description ?? "",
          summary: rationale,
          reasons: trajectory.reasons,
        });
        log.info("pipeline:finish_task:skill_proposed", {
          nodeId,
          domain: skillProposal.domain,
          reasons: trajectory.reasons,
        });
      }
    } catch (err) {
      log.warn("pipeline:finish_task:skill_proposal_failed", { error: String(err) });
    }
  }

  // Sentrux advisory check — session_end advisory (never blocks)
  let sentruxAdvisory: { warned: boolean; message?: string } | null = null;
  try {
    const sentruxSessionId = (options?.agentId) ?? null;
    sentruxAdvisory = await runSentruxAdvisoryCheck(new SentruxMcpAdapter(), sentruxSessionId);
    if (sentruxAdvisory.warned) {
      log.warn("pipeline:finish_task:sentrux_advisory", { nodeId, message: sentruxAdvisory.message });
    }
  } catch (err) {
    log.debug("pipeline:finish_task:sentrux_advisory_skipped", { error: String(err) });
  }

  log.info("pipeline:finish_task:ok", {
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
    ...(harnessGate ? { harnessGate } : {}),
    ruleSuggestions,
    artifactIds,
    ...(remediationValidation ? { remediationValidation } : {}),
    contractGate,
    testGate,
    invariantResult,
    ...(discoveredTestFiles.length > 0 ? { discoveredTestFiles } : {}),
    syntheticValidation,
    featureDepth: featureDepthReport,
    skillProposal,
    sentruxAdvisory,
  };
}
