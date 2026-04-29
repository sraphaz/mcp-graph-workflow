/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintE — GitHub operations wrapper.
 *
 * Thin layer over the `gh` CLI invoked via `node:child_process`.
 * Degrades gracefully when `gh` is absent (returns `kind: 'unsupported'`)
 * so the orchestrator can keep running locally without the cloud step.
 *
 * No npm dependency on @octokit — we shell out for two reasons:
 *   1. `gh` already handles auth (token from the user's environment).
 *   2. Zero install cost for users who don't use the auto-merge cycle.
 */

import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export type GhRunner = (args: ReadonlyArray<string>) => GhRunResult;

export interface GhRunResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

const realGhRunner: GhRunner = (args) => {
  const r: SpawnSyncReturns<string> = spawnSync("gh", args as string[], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    exitCode: r.status ?? -1,
  };
};

export type GhOutcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "unsupported"; reason: string }
  | { kind: "error"; reason: string };

export interface GithubOpsOptions {
  readonly runner?: GhRunner;
}

function run(opts: GithubOpsOptions, args: string[]): GhRunResult {
  const runner = opts.runner ?? realGhRunner;
  return runner(args);
}

/**
 * `true` when `gh --version` exits cleanly. Cached per-call; the
 * orchestrator should cache the verdict at startup if it cares.
 */
export function isGhAvailable(opts: GithubOpsOptions = {}): boolean {
  const r = run(opts, ["--version"]);
  return r.ok;
}

export interface OpenIssueInput {
  readonly title: string;
  readonly body: string;
  readonly labels?: ReadonlyArray<string>;
}

export interface OpenIssueResult {
  readonly url: string;
  readonly number: number | null;
}

function parseIssueUrl(stdout: string): OpenIssueResult {
  const url = stdout.trim().split("\n").pop() ?? "";
  const m = /\/issues\/(\d+)/.exec(url);
  return { url, number: m ? Number(m[1]) : null };
}

export function openIssue(
  input: OpenIssueInput,
  opts: GithubOpsOptions = {},
): GhOutcome<OpenIssueResult> {
  if (!isGhAvailable(opts)) {
    return { kind: "unsupported", reason: "gh CLI not available on PATH" };
  }
  const args = ["issue", "create", "--title", input.title, "--body", input.body];
  if (input.labels && input.labels.length > 0) {
    args.push("--label", input.labels.join(","));
  }
  const r = run(opts, args);
  if (!r.ok) return { kind: "error", reason: r.stderr.trim() || `gh exited ${r.exitCode}` };
  return { kind: "ok", data: parseIssueUrl(r.stdout) };
}

export interface CreatePrInput {
  readonly title: string;
  readonly body: string;
  readonly base: string;
  readonly head?: string;
  readonly draft?: boolean;
}

export interface CreatePrResult {
  readonly url: string;
  readonly number: number | null;
}

function parsePrUrl(stdout: string): CreatePrResult {
  const url = stdout.trim().split("\n").pop() ?? "";
  const m = /\/pull\/(\d+)/.exec(url);
  return { url, number: m ? Number(m[1]) : null };
}

export function createPr(
  input: CreatePrInput,
  opts: GithubOpsOptions = {},
): GhOutcome<CreatePrResult> {
  if (!isGhAvailable(opts)) {
    return { kind: "unsupported", reason: "gh CLI not available on PATH" };
  }
  const args = [
    "pr",
    "create",
    "--title",
    input.title,
    "--body",
    input.body,
    "--base",
    input.base,
  ];
  if (input.head) args.push("--head", input.head);
  if (input.draft) args.push("--draft");
  const r = run(opts, args);
  if (!r.ok) return { kind: "error", reason: r.stderr.trim() || `gh exited ${r.exitCode}` };
  return { kind: "ok", data: parsePrUrl(r.stdout) };
}

export interface PrStatus {
  readonly state: "OPEN" | "MERGED" | "CLOSED" | "UNKNOWN";
  readonly checks: "PENDING" | "SUCCESS" | "FAILURE" | "UNKNOWN";
  readonly mergeable: boolean | null;
}

export function prStatus(
  prNumber: number,
  opts: GithubOpsOptions = {},
): GhOutcome<PrStatus> {
  if (!isGhAvailable(opts)) {
    return { kind: "unsupported", reason: "gh CLI not available on PATH" };
  }
  const r = run(opts, [
    "pr",
    "view",
    String(prNumber),
    "--json",
    "state,statusCheckRollup,mergeable",
  ]);
  if (!r.ok) return { kind: "error", reason: r.stderr.trim() || `gh exited ${r.exitCode}` };
  try {
    const parsed = JSON.parse(r.stdout) as {
      state?: string;
      statusCheckRollup?: ReadonlyArray<{ conclusion?: string; status?: string }>;
      mergeable?: string;
    };
    const checks = rollupChecks(parsed.statusCheckRollup ?? []);
    return {
      kind: "ok",
      data: {
        state: (parsed.state as PrStatus["state"]) ?? "UNKNOWN",
        checks,
        mergeable:
          parsed.mergeable === "MERGEABLE"
            ? true
            : parsed.mergeable === "CONFLICTING"
              ? false
              : null,
      },
    };
  } catch (err) {
    return { kind: "error", reason: `failed to parse gh output: ${String(err)}` };
  }
}

function rollupChecks(
  checks: ReadonlyArray<{ conclusion?: string; status?: string }>,
): PrStatus["checks"] {
  if (checks.length === 0) return "UNKNOWN";
  if (checks.some((c) => c.conclusion === "FAILURE")) return "FAILURE";
  if (checks.some((c) => c.status === "IN_PROGRESS" || c.status === "QUEUED")) return "PENDING";
  if (checks.every((c) => c.conclusion === "SUCCESS")) return "SUCCESS";
  return "PENDING";
}
