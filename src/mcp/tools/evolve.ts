/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintE — `evolve` MCP tool.
 *
 * Surface for the auto-merge cycle. All actions are read-only or
 * dry-run — actual revert / PR creation happens outside this tool so
 * the agent host always confirms intent first.
 *
 * Actions:
 *   - batch-status     → show current orchestrator decision (close / stay)
 *   - simulate-revert  → dry-run revert plan for a given SHA (no I/O)
 *   - classify         → classify a regression payload into a bucket
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { mcpText, mcpError } from "../response-helpers.js";
import { logger } from "../../core/utils/logger.js";
import {
  decideCloseBatch,
  decidePostMergeAction,
  type BatchSnapshot,
} from "../../core/autonomy/auto-merge-orchestrator.js";
import {
  classifyRegression,
  buildIssueBody,
  type RegressionSignals,
} from "../../core/autonomy/self-map.js";
import {
  currentHead,
  currentBranch,
  commitsBetween,
  diffStat,
  isClean,
} from "../../core/autonomy/git-ops.js";

const EvolveActionSchema = z.enum(["batch-status", "simulate-revert", "classify"]);

const InputSchema = {
  action: EvolveActionSchema.describe("Sub-action to perform"),
  sha: z
    .string()
    .optional()
    .describe("Commit SHA — required for 'simulate-revert', ignored elsewhere"),
  baseRef: z
    .string()
    .optional()
    .describe("Base ref for batch-status (default: 'master'). Used to count commitsAhead."),
  ciOutput: z
    .string()
    .optional()
    .describe("CI / test output excerpt — used by 'classify' to bucket the regression"),
  harnessDelta: z
    .number()
    .optional()
    .describe("Harness score delta (positive = improvement) — used by 'classify'"),
  perfDelta: z
    .number()
    .optional()
    .describe("Latency / perf delta as a fraction (0.2 = 20%) — used by 'classify'"),
  harnessGrade: z
    .enum(["A", "B", "C", "D", "F"])
    .optional()
    .describe("Current harness grade — used by 'batch-status' to decide close-batch"),
  tasksOpen: z.number().int().nonnegative().optional(),
  tasksDone: z.number().int().nonnegative().optional(),
  testsGreen: z.boolean().optional(),
  commitsAhead: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Override commitsAhead (skips git rev-list) — useful for testing"),
};

function batchStatus(
  store: SqliteStore,
  args: {
    baseRef?: string;
    harnessGrade?: BatchSnapshot["harnessGrade"];
    tasksOpen?: number;
    tasksDone?: number;
    testsGreen?: boolean;
    commitsAhead?: number;
  },
): unknown {
  const baseRef = args.baseRef ?? "master";
  const head = currentHead();
  const branch = currentBranch();
  const clean = isClean();
  const commits =
    args.commitsAhead !== undefined
      ? new Array(args.commitsAhead).fill("")
      : head
        ? commitsBetween(baseRef, "HEAD")
        : [];

  // Best-effort task counts from the graph if caller didn't supply them.
  const doc = store.toGraphDocument();
  const tasks = doc.nodes.filter((n) => n.type === "task" || n.type === "subtask");
  const tasksDone = args.tasksDone ?? tasks.filter((n) => n.status === "done").length;
  const tasksOpen = args.tasksOpen ?? tasks.filter(
    (n) => n.status === "in_progress" || n.status === "ready" || n.status === "backlog",
  ).length;

  const snapshot: BatchSnapshot = {
    state: { kind: "BATCH_OPEN", commitsInBatch: commits.length },
    tasksDone,
    tasksOpen,
    testsGreen: args.testsGreen ?? false,
    harnessGrade: args.harnessGrade ?? null,
    commitsAhead: commits.length,
  };

  const decision = decideCloseBatch(snapshot);
  return {
    branch,
    head,
    cleanWorkingTree: clean,
    baseRef,
    snapshot,
    decision,
  };
}

function simulateRevert(sha: string): unknown {
  const head = currentHead();
  if (head === null) return { ok: false, reason: "not in a git repository" };
  const stats = diffStat(sha);
  return {
    ok: true,
    suspectSha: sha,
    head,
    diffStat: stats,
    plan: [
      "git status --porcelain   (caller verifies clean tree)",
      `git revert --no-edit ${sha}`,
      "git rev-parse HEAD       (capture new HEAD)",
      "open issue with auto-self-map output",
    ],
    note: "dry-run only — no commands executed by this tool",
  };
}

function classifyAction(signals: RegressionSignals): unknown {
  const classification = classifyRegression(signals);
  const body = buildIssueBody({
    classification,
    suspectSha: null,
    ciOutputExcerpt: signals.ciOutput,
  });
  // §SprintE.5 — `decidePostMergeAction` is wired here for the user to
  // see what the orchestrator would recommend given the same signals.
  // Fed only the binary tests/harness signals.
  const recommendation =
    typeof signals.harnessDelta === "number"
      ? decidePostMergeAction({
          testsGreenAfter: signals.ciOutput
            ? !/(error|fail|FAIL)/i.test(signals.ciOutput)
            : true,
          harnessBefore: null,
          harnessAfter: null,
        })
      : null;
  return { classification, recommendation, issueBodyPreview: body };
}

/** registerEvolve — auto-generated description placeholder. */
export function registerEvolve(server: McpServer, store: SqliteStore): void {
  server.tool(
    "evolve",
    "Auto-merge cycle introspection (read-only). Actions: batch-status (decide close vs stay), simulate-revert (dry-run a revert plan for a SHA), classify (bucket a regression payload).",
    InputSchema,
    async (input) => {
      logger.debug("tool:evolve", { action: input.action });
      try {
        switch (input.action) {
          case "batch-status":
            return mcpText({
              ok: true,
              action: "batch-status",
              ...((batchStatus(store, {
                baseRef: input.baseRef,
                harnessGrade: input.harnessGrade ?? null,
                tasksOpen: input.tasksOpen,
                tasksDone: input.tasksDone,
                testsGreen: input.testsGreen,
                commitsAhead: input.commitsAhead,
              }) ?? {}) as Record<string, unknown>),
            });
          case "simulate-revert":
            if (!input.sha) return mcpError("'simulate-revert' requires sha");
            return mcpText({
              ok: true,
              action: "simulate-revert",
              ...((simulateRevert(input.sha) ?? {}) as Record<string, unknown>),
            });
          case "classify":
            return mcpText({
              ok: true,
              action: "classify",
              ...((classifyAction({
                ciOutput: input.ciOutput,
                harnessDelta: input.harnessDelta,
                perfDelta: input.perfDelta,
              }) ?? {}) as Record<string, unknown>),
            });
        }
      } catch (err) {
        logger.warn("tool:evolve:error", { error: String(err) });
        return mcpError(`evolve failed: ${String(err)}`);
      }
    },
  );
}
