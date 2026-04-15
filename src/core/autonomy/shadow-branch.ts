/**
 * Shadow Branch — Git Transactional Layer (GTL)
 *
 * Treats each agent task execution as a database transaction using Git:
 * - BEGIN: create ai-shadow/{nodeId}-{timestamp} branch
 * - EXECUTE: agent works on shadow branch
 * - COMMIT: fast-forward merge to target branch on success
 * - ROLLBACK: discard shadow branch on failure
 *
 * Benefits:
 * - Isolation: main branch never touched by unvalidated code
 * - Traceability: failed attempts visible via git diff
 * - Concurrency: multiple agents on separate shadow branches
 */

import { execSync } from "node:child_process";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface ShadowBranchResult {
  branchName: string;
  created: boolean;
  error?: string;
}

export interface MergeResult {
  merged: boolean;
  branchName: string;
  error?: string;
}

export interface DiscardResult {
  discarded: boolean;
  branchName: string;
  error?: string;
}

// ── Public API ──────────────────────────────────────────

/**
 * Generate a deterministic shadow branch name from a node ID.
 */
export function getShadowBranchName(nodeId: string): string {
  if (!nodeId) return `ai-shadow/unknown-${Date.now()}`;
  return `ai-shadow/${nodeId}-${Date.now()}`;
}

/**
 * Create a shadow branch for isolated task execution.
 * Checks out the new branch from current HEAD.
 */
export function createShadowBranch(nodeId: string, cwd?: string): ShadowBranchResult {
  if (!nodeId) return { branchName: "", created: false, error: "nodeId is required" };
  const branchName = getShadowBranchName(nodeId);
  const opts = { cwd: cwd ?? process?.cwd() ?? ".", encoding: "utf-8" as const, timeout: 10000 };

  try {
    execSync(`git checkout -b ${branchName}`, opts);

    logger.info("shadow-branch:created", { nodeId, branchName });

    return { branchName, created: true };
  } catch (err) {
    const error = String(err);
    logger.warn("shadow-branch:create-failed", { nodeId, error });

    return { branchName, created: false, error };
  }
}

/**
 * Merge a shadow branch back to the target branch (fast-forward only).
 * Deletes the shadow branch after successful merge.
 */
export function mergeShadowBranch(
  branchName: string,
  targetBranch: string,
  cwd?: string,
): MergeResult {
  if (!branchName) return { merged: false, branchName: "", error: "branchName is required" };
  if (!targetBranch) return { merged: false, branchName, error: "targetBranch is required" };
  const opts = { cwd: cwd ?? process?.cwd() ?? ".", encoding: "utf-8" as const, timeout: 30000 };

  try {
    execSync(`git checkout ${targetBranch}`, opts);
    execSync(`git merge ${branchName} --ff-only`, opts);
    execSync(`git branch -D ${branchName}`, opts);

    logger.info("shadow-branch:merged", { branchName, targetBranch });

    return { merged: true, branchName };
  } catch (err) {
    const error = String(err);
    logger.warn("shadow-branch:merge-failed", { branchName, targetBranch, error });

    return { merged: false, branchName, error };
  }
}

/**
 * Discard a shadow branch (rollback scenario).
 * Switches back to target branch and deletes the shadow.
 */
export function discardShadowBranch(
  branchName: string,
  targetBranch: string,
  cwd?: string,
): DiscardResult {
  if (!branchName) return { discarded: false, branchName: "", error: "branchName is required" };
  if (!targetBranch) return { discarded: false, branchName, error: "targetBranch is required" };
  const opts = { cwd: cwd ?? process?.cwd() ?? ".", encoding: "utf-8" as const, timeout: 10000 };

  try {
    execSync(`git checkout ${targetBranch}`, opts);
    execSync(`git branch -D ${branchName}`, opts);

    logger.info("shadow-branch:discarded", { branchName, targetBranch });

    return { discarded: true, branchName };
  } catch (err) {
    const error = String(err);
    logger.warn("shadow-branch:discard-failed", { branchName, error });

    return { discarded: false, branchName, error };
  }
}
