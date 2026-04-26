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
 * Shadow Branch — Git Transactional Layer (GTL)
 *
 * Each agent task runs in an **isolated git worktree** at
 * `${tmpdir}/mcpg-wt-{nodeId}-{ts}` with a dedicated branch
 * `ai-shadow/{nodeId}-{ts}`. Worktrees are atomic: removing one leaves no
 * trace in the main repo's working tree or branch list.
 *
 * Lifecycle:
 *   - BEGIN     `git worktree add -b ai-shadow/X /tmp/mcpg-wt-X HEAD`
 *   - EXECUTE   agent works inside the worktree (its own cwd, own branch)
 *   - COMMIT    `git merge --ff-only` then `git worktree remove + branch -D`
 *   - ROLLBACK  `git worktree remove --force + branch -D`
 *   - GC        `git worktree prune` cleans worktree metadata for dirs that
 *               were rm-rf'd outside git's knowledge (e.g. crashes)
 *
 * Why worktrees instead of a plain `git checkout -b`:
 *   - **No trampling**: parallel agents don't share a working tree, so one
 *     agent's checkout no longer redirects the running shell of another.
 *   - **Atomic cleanup**: `git worktree remove` is one operation; the
 *     branch list of the main repo doesn't accumulate orphan refs.
 *   - **Backward compat**: callers that only need `branchName` still get
 *     it. Callers that pass back the full handle get the worktreePath
 *     too, enabling proper cleanup.
 */

import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface ShadowBranchHandle {
  branchName: string;
  /** Absolute path to the worktree directory; absent in legacy fallback mode. */
  worktreePath?: string;
}

export interface ShadowBranchResult extends ShadowBranchHandle {
  created: boolean;
  error?: string;
}

export interface MergeResult {
  merged: boolean;
  branchName: string;
  worktreePath?: string;
  error?: string;
}

export interface DiscardResult {
  discarded: boolean;
  branchName: string;
  worktreePath?: string;
  error?: string;
}

export interface PruneResult {
  pruned: boolean;
  reapedBranches: number;
  reapedWorktrees: number;
  output?: string;
  error?: string;
}

export interface PruneOptions {
  cwd?: string;
  /** Branches whose encoded timestamp is older than this are reaped. Default: 1h. */
  ttlMs?: number;
}

/** Accepts either the legacy string form or a `{branchName, worktreePath?}` handle. */
export type ShadowBranchInput = string | ShadowBranchHandle;

// ── Helpers ─────────────────────────────────────────────

function toHandle(input: ShadowBranchInput): ShadowBranchHandle {
  return typeof input === "string" ? { branchName: input } : input;
}

function getWorktreePath(nodeId: string): string {
  return join(tmpdir(), `mcpg-wt-${nodeId}-${Date.now()}`);
}

// ── Public API ──────────────────────────────────────────

/** Generate a deterministic shadow branch name from a node ID. */
export function getShadowBranchName(nodeId: string): string {
  if (!nodeId) return `ai-shadow/unknown-${Date.now()}`;
  return `ai-shadow/${nodeId}-${Date.now()}`;
}

/**
 * Create a shadow branch in an isolated worktree. Returns a handle the
 * caller passes back to merge/discard so the worktree path is preserved.
 *
 * Uses `git worktree add -b ai-shadow/X /tmp/mcpg-wt-X HEAD` so the
 * branch lives in `refs/heads/` (visible to `git branch`) but the
 * working tree is a separate directory — running agent's cwd is never
 * switched.
 */
export function createShadowBranch(nodeId: string, cwd?: string): ShadowBranchResult {
  if (!nodeId) return { branchName: "", created: false, error: "nodeId is required" };
  const branchName = getShadowBranchName(nodeId);
  const worktreePath = getWorktreePath(nodeId);
  const opts = { cwd: cwd ?? process?.cwd() ?? ".", encoding: "utf-8" as const, timeout: 10000 };

  try {
    execSync(`git worktree add -b ${branchName} ${worktreePath} HEAD`, opts);
    logger.info("shadow-branch:created", { nodeId, branchName, worktreePath });
    return { branchName, worktreePath, created: true };
  } catch (err) {
    const error = String(err);
    logger.warn("shadow-branch:create-failed", { nodeId, error });
    return { branchName, worktreePath, created: false, error };
  }
}

/**
 * Merge a shadow branch back to `targetBranch` (fast-forward only) and
 * remove its worktree. Accepts either the legacy string form or the
 * full handle from `createShadowBranch`.
 *
 * Operates on the main repo's `cwd` — never inside the worktree itself
 * (we'd be removing the floor we're standing on).
 */
export function mergeShadowBranch(
  branchOrHandle: ShadowBranchInput,
  targetBranch: string,
  cwd?: string,
): MergeResult {
  const handle = toHandle(branchOrHandle);
  if (!handle.branchName) return { merged: false, branchName: "", error: "branchName is required" };
  if (!targetBranch) return { merged: false, branchName: handle.branchName, error: "targetBranch is required" };
  const opts = { cwd: cwd ?? process?.cwd() ?? ".", encoding: "utf-8" as const, timeout: 30000 };

  try {
    // The agent already committed inside the worktree. From the main
    // repo's perspective, the branch ref is up to date; we just FF-merge.
    if (targetBranch !== "HEAD") {
      execSync(`git checkout ${targetBranch}`, opts);
    }
    execSync(`git merge ${handle.branchName} --ff-only`, opts);
    if (handle.worktreePath) {
      try {
        execSync(`git worktree remove ${handle.worktreePath}`, opts);
      } catch (wtErr) {
        // Worktree removal failure is non-fatal — branch deletion is the
        // important part. `git worktree prune` (later) reclaims metadata.
        logger.debug("shadow-branch:worktree-remove-soft-fail", {
          worktreePath: handle.worktreePath,
          reason: String(wtErr),
        });
      }
    }
    execSync(`git branch -D ${handle.branchName}`, opts);

    logger.info("shadow-branch:merged", {
      branchName: handle.branchName,
      worktreePath: handle.worktreePath,
      targetBranch,
    });
    return { merged: true, branchName: handle.branchName, worktreePath: handle.worktreePath };
  } catch (err) {
    const error = String(err);
    logger.warn("shadow-branch:merge-failed", {
      branchName: handle.branchName,
      targetBranch,
      error,
    });
    return { merged: false, branchName: handle.branchName, worktreePath: handle.worktreePath, error };
  }
}

/**
 * Discard a shadow branch (rollback). Removes the worktree atomically
 * with `--force` so any uncommitted work inside it is dropped, then
 * deletes the branch.
 */
export function discardShadowBranch(
  branchOrHandle: ShadowBranchInput,
  targetBranch: string,
  cwd?: string,
): DiscardResult {
  const handle = toHandle(branchOrHandle);
  if (!handle.branchName) return { discarded: false, branchName: "", error: "branchName is required" };
  if (!targetBranch) return { discarded: false, branchName: handle.branchName, error: "targetBranch is required" };
  const opts = { cwd: cwd ?? process?.cwd() ?? ".", encoding: "utf-8" as const, timeout: 10000 };

  try {
    if (handle.worktreePath) {
      try {
        execSync(`git worktree remove --force ${handle.worktreePath}`, opts);
      } catch (wtErr) {
        logger.debug("shadow-branch:worktree-remove-soft-fail", {
          worktreePath: handle.worktreePath,
          reason: String(wtErr),
        });
      }
    } else if (targetBranch !== "HEAD") {
      // Legacy path: no worktree, switch out of the branch before deleting.
      execSync(`git checkout ${targetBranch}`, opts);
    }
    execSync(`git branch -D ${handle.branchName}`, opts);

    logger.info("shadow-branch:discarded", {
      branchName: handle.branchName,
      worktreePath: handle.worktreePath,
      targetBranch,
    });
    return { discarded: true, branchName: handle.branchName, worktreePath: handle.worktreePath };
  } catch (err) {
    const error = String(err);
    logger.warn("shadow-branch:discard-failed", { branchName: handle.branchName, error });
    return { discarded: false, branchName: handle.branchName, worktreePath: handle.worktreePath, error };
  }
}

/** Extract the trailing `-<digits>` timestamp the branch-name builder embeds. */
function parseShadowTimestamp(branchName: string): number | null {
  const match = /-(\d{10,})$/.exec(branchName);
  if (!match) return null;
  const ts = Number(match[1]);
  return Number.isFinite(ts) && ts > 0 ? ts : null;
}

/** Map ai-shadow branch → its registered worktree path, parsed from `git worktree list --porcelain`. */
function listShadowWorktrees(execOpts: {
  cwd: string;
  encoding: "utf-8";
  timeout: number;
}): Map<string, string> {
  const map = new Map<string, string>();
  let raw: string;
  try {
    raw = execSync("git worktree list --porcelain", execOpts).toString();
  } catch {
    return map; // best-effort
  }
  let currentPath = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length).trim();
    } else if (line.startsWith("branch refs/heads/ai-shadow/")) {
      const branch = line.slice("branch refs/heads/".length).trim();
      if (currentPath) map.set(branch, currentPath);
    }
  }
  return map;
}

/**
 * Best-effort GC — reaps shadow branches and worktrees whose embedded
 * timestamp is older than `ttlMs` (default 1h), then runs
 * `git worktree prune` to reclaim metadata for dirs removed outside
 * git's knowledge. Never throws — every step is silent-fail.
 *
 * Wired into daemon startup and shutdown so leftover shadows from
 * crashed agents are reaped when the next daemon comes up. Cheap even
 * with many branches (one `for-each-ref` + N small ops).
 */
export function pruneOrphanWorktrees(options?: PruneOptions): PruneResult {
  const cwd = options?.cwd ?? process?.cwd() ?? ".";
  const envTtl = Number(process.env.MCP_GRAPH_SHADOW_TTL_MS ?? "");
  const ttlMs = options?.ttlMs ?? (Number.isFinite(envTtl) && envTtl > 0 ? envTtl : 60 * 60 * 1000);
  const execOpts = { cwd, encoding: "utf-8" as const, timeout: 10000 };
  const cutoff = Date.now() - ttlMs;
  let reapedBranches = 0;
  let reapedWorktrees = 0;

  // 1. Enumerate ai-shadow/* branches (silent-fail; empty list on error).
  let branches: string[] = [];
  try {
    const out = execSync(
      "git for-each-ref --format='%(refname:short)' refs/heads/ai-shadow",
      execOpts,
    ).toString();
    branches = out.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch (err) {
    logger.debug("shadow-branch:prune:list-failed", { error: String(err) });
  }

  // 2. For each stale branch, remove its worktree (if any) then delete the branch.
  const wtMap = branches.length > 0 ? listShadowWorktrees(execOpts) : new Map<string, string>();
  for (const branch of branches) {
    const ts = parseShadowTimestamp(branch);
    if (ts === null || ts >= cutoff) continue; // skip fresh or unparsable
    const wtPath = wtMap.get(branch);
    if (wtPath) {
      try {
        execSync(`git worktree remove --force ${wtPath}`, execOpts);
        reapedWorktrees += 1;
      } catch (err) {
        logger.debug("shadow-branch:prune:wt-remove-failed", { branch, wtPath, error: String(err) });
      }
    }
    try {
      execSync(`git branch -D ${branch}`, execOpts);
      reapedBranches += 1;
    } catch (err) {
      logger.debug("shadow-branch:prune:branch-delete-failed", { branch, error: String(err) });
    }
  }

  // 3. Cheap metadata sweep.
  try {
    const output = execSync("git worktree prune --verbose", execOpts).toString();
    if (reapedBranches > 0 || reapedWorktrees > 0) {
      logger.info("shadow-branch:prune-ok", { reapedBranches, reapedWorktrees, ttlMs });
    } else {
      logger.debug("shadow-branch:prune-ok", { reapedBranches, reapedWorktrees, output });
    }
    return { pruned: true, reapedBranches, reapedWorktrees, output };
  } catch (err) {
    const error = String(err);
    logger.debug("shadow-branch:prune-failed", { error });
    return { pruned: false, reapedBranches, reapedWorktrees, error };
  }
}
