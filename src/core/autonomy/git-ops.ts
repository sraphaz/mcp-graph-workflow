/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintE — Git operations wrapper.
 *
 * Thin layer over `git` CLI invoked via `node:child_process`. Keeps the
 * dependency surface zero (no simple-git, no isomorphic-git) and stays
 * easy to mock for tests via the injected `runner`.
 *
 * Design rule: **never** issue a destructive remote operation here
 * (push --force, push --delete, branch -D on protected refs). The
 * orchestrator that consumes git-ops is responsible for confirming
 * intent before invoking these functions; this module only carries
 * out the local-git mechanics.
 */

import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export interface GitRunResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export type GitRunner = (args: ReadonlyArray<string>, cwd?: string) => GitRunResult;

const realGitRunner: GitRunner = (args, cwd) => {
  const rVar: SpawnSyncReturns<string> = spawnSync("git", args as string[], {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    ok: rVar.status === 0,
    stdout: rVar.stdout ?? "",
    stderr: rVar.stderr ?? "",
    exitCode: rVar.status ?? -1,
  };
};

export interface GitOpsOptions {
  readonly cwd?: string;
  readonly runner?: GitRunner;
}

function run(opts: GitOpsOptions, args: string[]): GitRunResult {
  const runner = opts.runner ?? realGitRunner;
  return runner(args, opts.cwd);
}

/**
 * Resolve the SHA of HEAD. Returns null when not in a git repository.
 */
export function currentHead(opts: GitOpsOptions = {}): string | null {
  const rVar = run(opts, ["rev-parse", "HEAD"]);
  return rVar.ok ? rVar.stdout.trim() : null;
}

/**
 * Return the SHA list (newest first) between two refs, or [] on failure.
 * Useful for orchestrator's batch boundary detection.
 */
export function commitsBetween(
  baseRef: string,
  headRef: string,
  opts: GitOpsOptions = {},
): ReadonlyArray<string> {
  const rVar = run(opts, ["rev-list", `${baseRef}..${headRef}`]);
  if (!rVar.ok) return [];
  return rVar.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export interface DiffStat {
  readonly filesChanged: number;
  readonly insertions: number;
  readonly deletions: number;
}

/**
 * Parse the trailing line of `git diff --shortstat`:
 *   " 3 files changed, 47 insertions(+), 12 deletions(-)"
 */
export function diffStat(sha: string, opts: GitOpsOptions = {}): DiffStat {
  const rVar = run(opts, ["diff", "--shortstat", `${sha}^!`]);
  if (!rVar.ok) return { filesChanged: 0, insertions: 0, deletions: 0 };
  const text = rVar.stdout.trim();
  const files = /(\d+)\s+files?\s+changed/.exec(text);
  const ins = /(\d+)\s+insertions?\(\+\)/.exec(text);
  const del = /(\d+)\s+deletions?\(-\)/.exec(text);
  return {
    filesChanged: files ? Number(files[1]) : 0,
    insertions: ins ? Number(ins[1]) : 0,
    deletions: del ? Number(del[1]) : 0,
  };
}

export interface RevertResult {
  readonly ok: boolean;
  readonly newHead: string | null;
  readonly stderr: string;
}

/**
 * Revert a single commit by SHA. Uses `--no-edit` to avoid the editor
 * hang in non-interactive contexts. Caller is responsible for ensuring
 * the working tree is clean before invocation.
 */
export function revert(sha: string, opts: GitOpsOptions = {}): RevertResult {
  const rVar = run(opts, ["revert", "--no-edit", sha]);
  if (!rVar.ok) {
    return { ok: false, newHead: null, stderr: rVar.stderr };
  }
  return { ok: true, newHead: currentHead(opts), stderr: "" };
}

/**
 * Run `git bisect` with a deterministic predicate.
 *
 * The predicate is a *pure callback* the caller supplies — it receives
 * the SHA under test and returns `"good" | "bad" | "skip"`. This keeps
 * git-ops free of opinions about how the caller checks regression
 * (running tests, harness scan, custom metric).
 *
 * Returns the first known-bad SHA, or null when the search collapses.
 *
 * Note: this is a *deterministic linear walk* over `commitsBetween`,
 * not actual `git bisect run`. The real `git bisect` requires
 * mutating repo state which is hostile to mocking and concurrency;
 * the linear walk is O(N) where N = commits in the batch (bounded
 * to ≤20 by the orchestrator).
 */
export type BisectVerdict = "good" | "bad" | "skip";
export type BisectPredicate = (sha: string) => BisectVerdict;

/** bisect — auto-generated description placeholder. */
export function bisect(
  goodSha: string,
  badSha: string,
  predicate: BisectPredicate,
  opts: GitOpsOptions = {},
): string | null {
  const all = commitsBetween(goodSha, badSha, opts);
  // Walk newest → oldest; return the first commit the predicate calls bad.
  for (const sha of all) {
    const verdict = predicate(sha);
    if (verdict === "bad") return sha;
    if (verdict === "good") return null;
  }
  return null;
}

/**
 * Return the current branch name, or null when detached / not a repo.
 */
export function currentBranch(opts: GitOpsOptions = {}): string | null {
  const rVar = run(opts, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!rVar.ok) return null;
  const name = rVar.stdout.trim();
  return name.length > 0 && name !== "HEAD" ? name : null;
}

/**
 * `true` when the working tree has no uncommitted changes.
 */
export function isClean(opts: GitOpsOptions = {}): boolean {
  const rVar = run(opts, ["status", "--porcelain"]);
  return rVar.ok && rVar.stdout.trim().length === 0;
}

/**
 * Per-file unified diff between `baseRef` (default: HEAD) and the working
 * tree. Returns the full diff body (no headers stripped) — caller is
 * responsible for trimming if a snippet is needed. Empty string on
 * failure or if the file is unchanged.
 */
export function diffForFile(
  path: string,
  baseRef: string = "HEAD",
  opts: GitOpsOptions = {},
): string {
  const rVar = run(opts, ["diff", "--unified=3", baseRef, "--", path]);
  return rVar.ok ? rVar.stdout : "";
}

/**
 * Lightweight per-file change shape used by the agent monitor UI.
 * Aggregates touched files via `git diff --numstat` so the dashboard can
 * render one row per file with +/- counts, then fetches per-file diff
 * lazily on expansion.
 */
export interface ChangedFile {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}

/** changedFiles — auto-generated description placeholder. */
export function changedFiles(
  baseRef: string = "HEAD",
  opts: GitOpsOptions = {},
): ReadonlyArray<ChangedFile> {
  const rVar = run(opts, ["diff", "--numstat", baseRef]);
  if (!rVar.ok) return [];
  const out: ChangedFile[] = [];
  for (const line of rVar.stdout.split("\n")) {
    const mVar = /^(-|\d+)\s+(-|\d+)\s+(.+)$/.exec(line);
    if (!mVar) continue;
    const additions = mVar[1] === "-" ? 0 : Number(mVar[1]);
    const deletions = mVar[2] === "-" ? 0 : Number(mVar[2]);
    out.push({ path: mVar[3].trim(), additions, deletions });
  }
  return out;
}
